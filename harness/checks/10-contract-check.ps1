<#
    闸门 10-contract-check：前后端认证契约的字段名双向比对

    曾经的真实故障：后端 record 的组件名是 publicId / displayName / status，
    前端自己造了一套 id / name / role。两侧编译都过、测试都绿，页面拿到的却是
    undefined——因为字段名漂移不在任何一侧的类型系统视野里。人肉对照不可靠，
    所以让闸门来盯：字段名的真相在后端 record，前端契约必须逐字镜像。

    校验方式：
      1. 解析后端 web/auth/dto/*.java 与 common/web/ErrorResponse.java 的 record 组件名
         （record 声明可能跨多行，用 (?s) 跨行匹配；组件名 = 每个参数段的最后一个标识符）
      2. 解析 frontend/lib/contracts/auth.ts 的 interface 字段名
      3. 两侧的接口名集合必须相等，共有接口的字段名集合必须相等
      4. 所有字段名必须匹配 ^[a-z][A-Za-z0-9]*$（前后端一律 camelCase）
      5. 后端 dto 目录内出现 @JsonProperty 即失败：靠注解改名会让契约与源码脱钩
      6. 解析结果为空即失败：正则失配不能表现为「两边都空所以相等」的假绿

    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$backendDtoDir = 'backend/src/main/java/com/luyi/myfirst/web/auth/dto'
# ErrorResponse 不在 dto 目录，但它是前端要解析的错误体，同样属于契约面。
$backendExtraFiles = @('backend/src/main/java/com/luyi/myfirst/common/web/ErrorResponse.java')
$frontendContract = 'frontend/lib/contracts/auth.ts'

$camelCasePattern = '^[a-z][A-Za-z0-9]*$'
# 令牌只经 Set-Cookie 传递，响应体里出现这些字段名就是违约（wanderchain-auth spec 的硬约束）。
$forbiddenFields = @('token', 'accessToken', 'refreshToken', 'sessionId')

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

function Get-BackendShapes {
    param([string[]]$Files)

    $shapes = @{}
    foreach ($file in $Files) {
        if (-not (Test-Path -LiteralPath $file)) {
            Add-Problem "$file 不存在"
            continue
        }

        $text = Get-Content -LiteralPath $file -Raw -Encoding UTF8

        if ($text -cmatch '@JsonProperty') {
            Add-Problem "$file 出现 @JsonProperty：字段名必须在 record 组件名上就对齐，靠注解改名会让前端契约与后端源码脱钩"
        }

        $recordPattern = '(?s)public\s+record\s+(?<name>\w+)\s*\((?<params>.*?)\)\s*(?:implements[^{]*)?\{'
        foreach ($match in [regex]::Matches($text, $recordPattern)) {
            $name = $match.Groups['name'].Value
            $params = $match.Groups['params'].Value

            # 先摘掉注解，再按逗号切分；每段的最后一个标识符就是组件名（前面是类型）。
            $stripped = [regex]::Replace($params, '@\w+(\([^)]*\))?', ' ')
            $components = @()
            foreach ($segment in ($stripped -split ',')) {
                $tokens = [regex]::Matches($segment, '\w+')
                if ($tokens.Count -gt 0) {
                    $components += $tokens[$tokens.Count - 1].Value
                }
            }

            if ($shapes.ContainsKey($name)) {
                Add-Problem "后端出现同名 record：$name"
            }
            $shapes[$name] = $components
        }
    }
    return $shapes
}

function Get-FrontendShapes {
    param([string]$File)

    $shapes = @{}
    if (-not (Test-Path -LiteralPath $File)) {
        Add-Problem "$File 不存在"
        return $shapes
    }

    $text = Get-Content -LiteralPath $File -Raw -Encoding UTF8
    foreach ($match in [regex]::Matches($text, '(?s)export\s+interface\s+(?<name>\w+)\s*\{(?<body>.*?)\}')) {
        $name = $match.Groups['name'].Value
        $body = $match.Groups['body'].Value

        # 契约文件的 interface 允许写成单行，所以分隔符同时认分号与换行。
        $fields = @()
        foreach ($segment in ($body -split '[;\r\n]')) {
            $fieldMatch = [regex]::Match($segment, '^\s*(?<field>\w+)\??\s*:')
            if ($fieldMatch.Success) {
                $fields += $fieldMatch.Groups['field'].Value
            }
        }

        if ($shapes.ContainsKey($name)) {
            Add-Problem "前端契约出现同名 interface：$name"
        }
        $shapes[$name] = $fields
    }
    return $shapes
}

$backendFiles = @()
if (Test-Path -LiteralPath $backendDtoDir) {
    $backendFiles += @(Get-ChildItem -LiteralPath $backendDtoDir -Filter '*.java' -File |
        ForEach-Object { $_.FullName.Substring($projectRoot.Length + 1).Replace('\', '/') })
}
else {
    Add-Problem "$backendDtoDir 不存在"
}
$backendFiles += $backendExtraFiles

$backendShapes = Get-BackendShapes -Files $backendFiles
$frontendShapes = Get-FrontendShapes -File $frontendContract

# 防伪：解析出空集合说明正则整体失配，此时「两侧相等」毫无意义。
if ($backendShapes.Count -eq 0) {
    Add-Problem '后端没有解析出任何 record：闸门自身的解析规则已经失配，不是契约真的为空'
}
if ($frontendShapes.Count -eq 0) {
    Add-Problem "前端契约没有解析出任何 interface：$frontendContract 是否还导出 interface"
}

$backendNames = @($backendShapes.Keys | Sort-Object)
$frontendNames = @($frontendShapes.Keys | Sort-Object)

foreach ($name in $backendNames) {
    if (-not $frontendShapes.ContainsKey($name)) {
        Add-Problem "后端 record $name 在前端契约里没有对应 interface"
    }
}
foreach ($name in $frontendNames) {
    if (-not $backendShapes.ContainsKey($name)) {
        Add-Problem "前端契约的 interface $name 在后端找不到同名 record：契约不得凭空造形状"
    }
}

$fieldCount = 0
foreach ($name in $backendNames) {
    if (-not $frontendShapes.ContainsKey($name)) { continue }

    $backendFields = @($backendShapes[$name])
    $frontendFields = @($frontendShapes[$name])
    if ($backendFields.Count -eq 0) {
        Add-Problem "$name 的组件名解析为空：record 声明格式可能已经超出闸门的解析规则"
        continue
    }

    foreach ($field in ($backendFields + $frontendFields)) {
        if ($field -notmatch $camelCasePattern) {
            Add-Problem "$name 的字段 $field 不是 camelCase（前后端一律小写开头、不带下划线）"
        }
        if ($forbiddenFields -ccontains $field) {
            Add-Problem "$name 含字段 $field：令牌只经 Set-Cookie 传递，响应体不得出现令牌字段"
        }
    }

    $missingInFrontend = @($backendFields | Where-Object { $frontendFields -cnotcontains $_ } | Sort-Object -Unique)
    $extraInFrontend = @($frontendFields | Where-Object { $backendFields -cnotcontains $_ } | Sort-Object -Unique)

    if ($missingInFrontend.Count -gt 0) {
        Add-Problem "$name 后端有而前端契约没有的字段：$($missingInFrontend -join ', ')"
    }
    if ($extraInFrontend.Count -gt 0) {
        Add-Problem "$name 前端契约有而后端没有的字段：$($extraInFrontend -join ', ')（新增字段先改后端 DTO）"
    }

    $fieldCount += $backendFields.Count
}

if ($problems.Count -gt 0) {
    Write-Host '10-contract-check FAILED: 前后端认证契约字段名不一致' -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "  $problem" -ForegroundColor Red
    }
    exit 1
}

Write-Host ('10-contract-check PASSED: {0} 个接口、{1} 个字段名两侧逐字一致' -f $backendNames.Count, $fieldCount) -ForegroundColor Green
exit 0
