# 闸门 10：前后端契约一致性（字段名 + 类型，双向静态比对；扫描范围可配置）
# 纯文本静态解析，不需要数据库、Redis 或服务启动。
# - 后端：record 组件的「名字 + 类型」；前端：interface 字段的「名字 + 类型」与同文件 type 别名。
# - 双向比字段名；共有字段按 Java↔TS 映射表归一后比类型；映射表外或归一失败一律 fail-closed。
# 约定：通过 exit 0，不通过 exit 1；无交互。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Resolve-RepoPath([string]$rel) {
    return Join-Path $root ($rel -replace '/', '\')
}

# ===== 受管契约清单（追加新模块只需在此加一对，比对逻辑对每个 pair 独立执行）=====
$contractPairs = @(
    @{
        Name            = 'auth'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/auth/dto')
        BackendFiles    = @('backend/src/main/java/com/luyi/myfirst/common/web/ErrorResponse.java')
        Frontend        = 'frontend/lib/contracts/auth.ts'
        ForbiddenFields = @('token', 'accessToken', 'refreshToken', 'sessionId')
    }
)

# ===== Java → TS 映射表（表外类型 fail-closed）=====
function Map-JavaToTs([string]$t) {
    $t = $t.Trim()
    if ($t -match '^(String|CharSequence|UUID)$') { return 'string' }
    if ($t -match '^(Instant|OffsetDateTime|ZonedDateTime|LocalDate|LocalDateTime|LocalTime)$') { return 'string' }
    if ($t -match '^(int|Integer|long|Long|short|Short|double|Double|float|Float|BigDecimal|BigInteger)$') { return 'number' }
    if ($t -match '^(boolean|Boolean)$') { return 'boolean' }
    if ($t -match '^(?:List|Set|Collection)<(.+)>$') {
        $inner = Map-JavaToTs $matches[1]
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '^(.+)\[\]$') {
        $inner = Map-JavaToTs $matches[1]
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    return $null   # 映射表外：嵌套自定义类型、Map、通配泛型等 → fail-closed
}

# ===== 前端 TS 类型归一化（$aliases 为同文件 type 别名表）=====
function Normalize-Ts([string]$t, [hashtable]$aliases, [int]$depth = 0) {
    if ($depth -gt 8) { return $null }
    $t = $t.Trim()
    $t = [regex]::Replace($t, '\s*\|\s*null\b', '').Trim()
    if ($t -eq '') { return $null }
    if ($t -match '^Array<(.+)>$') {
        $inner = Normalize-Ts $matches[1] $aliases ($depth + 1)
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '^(.+)\[\]$') {
        $inner = Normalize-Ts $matches[1] $aliases ($depth + 1)
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '\|') {
        $norm = @()
        foreach ($p in ($t -split '\|')) {
            $n = Normalize-Ts $p $aliases ($depth + 1)
            if (-not $n) { return $null }
            $norm += $n
        }
        $uniq = @($norm | Select-Object -Unique)
        if ($uniq.Count -eq 1) { return $uniq[0] } else { return $null }
    }
    if ($t -match "^'.*'$" -or $t -match '^".*"$') { return 'string' }
    if ($t -match '^(string|number|boolean)$') { return $t }
    if ($aliases.ContainsKey($t)) { return Normalize-Ts $aliases[$t] $aliases ($depth + 1) }
    return $null   # 未知标识符 → fail-closed
}

$failures = @()
$pairSummaries = @()

if ($contractPairs.Count -eq 0) {
    Write-Host '契约闸门(10) 失败：受管契约清单为空，没有任何受管对象（防伪）。'
    exit 1
}

foreach ($pair in $contractPairs) {
    $pairName = $pair.Name

    # ---- 收集后端 record 字段（名字 → Java 类型）----
    $backendTypes = [ordered]@{}
    $backendRecordCount = 0
    $backendFilesList = @()
    foreach ($d in $pair.BackendDirs) {
        $p = Resolve-RepoPath $d
        if (Test-Path $p) { $backendFilesList += @(Get-ChildItem $p -Filter *.java -File) }
    }
    foreach ($bf in $pair.BackendFiles) {
        $p = Resolve-RepoPath $bf
        if (Test-Path $p) { $backendFilesList += @(Get-Item $p) }
    }
    foreach ($f in $backendFilesList) {
        $text = Get-Content $f.FullName -Raw
        $text = [regex]::Replace($text, '(?s)/\*.*?\*/', ' ')
        $text = [regex]::Replace($text, '(?m)//.*$', ' ')
        foreach ($m in [regex]::Matches($text, '(?s)\brecord\s+(\w+)\s*\((.*?)\)\s*(?:implements[^{]*)?\{')) {
            $backendRecordCount++
            $paramsText = [regex]::Replace($m.Groups[2].Value, '@\w+(\([^)]*\))?', ' ')
            foreach ($pp in ($paramsText -split ',')) {
                $pp = $pp.Trim()
                if ($pp -match '^(?<type>.+?)\s+(?<name>\w+)$') {
                    $backendTypes[$matches['name']] = $matches['type'].Trim()
                }
            }
        }
    }

    # ---- 后端出现 @JsonProperty 判红 ----
    foreach ($f in $backendFilesList) {
        if ((Get-Content $f.FullName -Raw) -match '@JsonProperty') {
            $failures += "[$pairName] 后端 $($f.Name) 出现 @JsonProperty（字段映射必须与 Java 组件名一致）"
        }
    }

    # ---- 后端字段名 camelCase 判红 ----
    foreach ($name in $backendTypes.Keys) {
        if ($name -cnotmatch '^[a-z][A-Za-z0-9]*$') {
            $failures += "[$pairName] 后端字段 $name 不是 camelCase"
        }
    }

    # ---- 收集前端 interface 字段（名字 → TS 类型）与 type 别名 ----
    $fePath = Resolve-RepoPath $pair.Frontend
    if (-not (Test-Path $fePath)) {
        $failures += "[$pairName] 前端契约文件缺失：$fePath"
        continue
    }
    $feText = Get-Content $fePath -Raw
    $feAliases = @{}
    foreach ($m in [regex]::Matches($feText, '(?m)^\s*(?:export\s+)?type\s+(\w+)\s*=\s*(.+?)\s*;?\s*$')) {
        $feAliases[$m.Groups[1].Value] = $m.Groups[2].Value.Trim()
    }
    $frontendTypes = [ordered]@{}
    $frontendInterfaceCount = 0
    foreach ($blk in [regex]::Matches($feText, '(?s)interface\s+(\w+)\s*\{(.*?)\n\}')) {
        $frontendInterfaceCount++
        foreach ($line in ($blk.Groups[2].Value -split "`n")) {
            if ($line -match '^\s*(\w+)\s*\??\s*:\s*([^;]+)') {
                $frontendTypes[$matches[1]] = $matches[2].Trim()
            }
        }
    }

    # ---- 防伪：任一侧解析出空集合即判红 ----
    if ($backendTypes.Count -eq 0) { $failures += "[$pairName] 后端未解析出任何 record 字段（解析规则失效）" }
    if ($frontendTypes.Count -eq 0) { $failures += "[$pairName] 前端未解析出任何 interface 字段（解析规则失效）" }

    # ---- 令牌字段禁现 ----
    foreach ($forbidden in $pair.ForbiddenFields) {
        if ($backendTypes.Contains($forbidden)) { $failures += "[$pairName] 后端字段 $forbidden 命中令牌字段禁现红线" }
        if ($frontendTypes.Contains($forbidden)) { $failures += "[$pairName] 前端字段 $forbidden 命中令牌字段禁现红线" }
    }

    # ---- 字段名双向比对 ----
    foreach ($name in $backendTypes.Keys) {
        if (-not $frontendTypes.Contains($name)) { $failures += "[$pairName] 后端有、前端缺：$name" }
    }
    foreach ($name in $frontendTypes.Keys) {
        if (-not $backendTypes.Contains($name)) { $failures += "[$pairName] 前端有、后端缺：$name" }
    }

    # ---- 字段类型比对（共有字段，经映射/归一后）----
    $typeChecked = 0
    foreach ($name in $backendTypes.Keys) {
        if (-not $frontendTypes.Contains($name)) { continue }
        $javaType = $backendTypes[$name]
        $tsType = $frontendTypes[$name]
        $mapped = Map-JavaToTs $javaType
        if (-not $mapped) {
            $failures += "[$pairName] 字段 $name：后端类型 $javaType 不在 Java↔TS 映射表内（fail-closed）"
            continue
        }
        $normalized = Normalize-Ts $tsType $feAliases 0
        if (-not $normalized) {
            $failures += "[$pairName] 字段 $name：前端类型 $tsType 无法归一化（fail-closed）"
            continue
        }
        $typeChecked++
        if ($mapped -ne $normalized) {
            $failures += "[$pairName] 字段 $name 类型不一致：后端 $javaType→$mapped，前端 $tsType→$normalized"
        }
    }

    $pairSummaries += "[$pairName] 后端 record $backendRecordCount 个 / 前端 interface $frontendInterfaceCount 个；两侧字段名各 $($backendTypes.Count) 个，类型比对 $typeChecked 个共有字段全部一致（含 @JsonProperty/camelCase/令牌禁现检查）"
}

if ($failures.Count -gt 0) {
    Write-Host '契约闸门(10) 失败：'
    foreach ($x in ($failures | Select-Object -Unique)) { Write-Host "  - $x" }
    exit 1
}

Write-Host "契约闸门(10) 通过：受管 $($contractPairs.Count) 组契约，字段名 + 类型双向一致。"
foreach ($s in $pairSummaries) { Write-Host "  $s" }
exit 0
