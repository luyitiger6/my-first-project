# 闸门 10：前后端契约一致性（字段名 + 类型，双向静态比对；扫描范围可配置）
# 纯文本静态解析，不需要数据库、Redis 或服务启动。
# - 后端：record 组件的「名字 + 类型」；前端：interface 字段的「名字 + 类型」与同文件 type 别名。
# - 双向比字段名；共有字段按 Java→TS 映射表归一后比类型；映射表外或归一失败一律 fail-closed。
# - 若在飞 change 的 design.md 含「## 契约」表，额外三方比对：契约表 ↔ 后端 record ↔ 前端 interface（契约先行）。
# 约定：通过 exit 0，不通过 exit 1；无交互。
[CmdletBinding()]
param(
    [string]$ContractRoot
)
$ErrorActionPreference = 'Stop'
$root = $ContractRoot
if (-not $root) { $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }

function Resolve-RepoPath([string]$rel) {
    # 清单里的相对路径统一写成 /；Join-Path 在 Windows 与 Linux 上都接受正斜杠
    return Join-Path $root $rel
}

# ===== 受管契约清单（追加新模块只需在此加一对，比对逻辑对每个 pair 独立执行）=====
$contractPairs = @(
    @{
        Name            = 'auth'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/auth/dto')
        BackendFiles    = @('backend/src/main/java/com/luyi/myfirst/common/web/ErrorResponse.java')
        Frontend        = 'frontend/lib/contracts/auth.ts'
        ForbiddenFields = @('token', 'accessToken', 'refreshToken', 'sessionId')
    },
    @{
        Name            = 'posts'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/post/dto', 'backend/src/main/java/com/luyi/myfirst/web/post/interaction/dto')
        BackendFiles    = @()
        Frontend        = 'frontend/lib/contracts/posts.ts'
        ForbiddenFields = @()
    },
    @{
        Name            = 'attractions'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/attraction/dto')
        BackendFiles    = @()
        Frontend        = 'frontend/lib/contracts/attractions.ts'
        ForbiddenFields = @()
    },
    @{
        Name            = 'media'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/media/dto')
        BackendFiles    = @()
        Frontend        = 'frontend/lib/contracts/media.ts'
        ForbiddenFields = @()
    },
    @{
        Name            = 'profile'
        BackendDirs     = @('backend/src/main/java/com/luyi/myfirst/web/profile/dto')
        BackendFiles    = @()
        Frontend        = 'frontend/lib/contracts/profile.ts'
        ForbiddenFields = @()
    }
)

# ===== Java → TS 映射表（表外类型 fail-closed）=====
function Map-JavaToTs([string]$t, [string[]]$knownRecords = @()) {
    $t = $t.Trim()
    if ($t -match '^(String|CharSequence|UUID)$') { return 'string' }
    if ($t -match '^(Instant|OffsetDateTime|ZonedDateTime|LocalDate|LocalDateTime|LocalTime)$') { return 'string' }
    if ($t -match '^(int|Integer|long|Long|short|Short|double|Double|float|Float|BigDecimal|BigInteger)$') { return 'number' }
    if ($t -match '^(boolean|Boolean)$') { return 'boolean' }
    if ($t -in $knownRecords) { return $t }
    if ($t -match '^(?:List|Set|Collection)<(.+)>$') {
        $inner = $matches[1].Trim()
        if ($inner -in $knownRecords) { return "Array<$inner>" }
        $inner = Map-JavaToTs $inner $knownRecords
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '^(.+)\[\]$') {
        $inner = $matches[1].Trim()
        if ($inner -in $knownRecords) { return "Array<$inner>" }
        $inner = Map-JavaToTs $inner $knownRecords
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    return $null   # 映射表外：嵌套自定义类型、Map、通配泛型等 → fail-closed
}

# ===== 前端 TS 类型归一化（$aliases 为同文件 type 别名表）=====
function Normalize-Ts([string]$t, [hashtable]$aliases, [int]$depth = 0, [string[]]$knownInterfaces = @()) {
    if ($depth -gt 8) { return $null }
    $t = $t.Trim()
    $t = [regex]::Replace($t, '\s*\|\s*null\b', '').Trim()
    if ($t -eq '') { return $null }
    if ($t -in $knownInterfaces) { return $t }
    if ($t -match '^Array<(.+)>$') {
        $inner = Normalize-Ts $matches[1] $aliases ($depth + 1) $knownInterfaces
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '^(.+)\[\]$') {
        $inner = Normalize-Ts $matches[1] $aliases ($depth + 1) $knownInterfaces
        if ($inner) { return "Array<$inner>" } else { return $null }
    }
    if ($t -match '\|') {
        $norm = @()
        foreach ($p in ($t -split '\|')) {
            $n = Normalize-Ts $p $aliases ($depth + 1) $knownInterfaces
            if (-not $n) { return $null }
            $norm += $n
        }
        $uniq = @($norm | Select-Object -Unique)
        if ($uniq.Count -eq 1) { return $uniq[0] } else { return $null }
    }
    if ($t -match "^'.*'$" -or $t -match '^".*"$') { return 'string' }
    if ($t -match '^(string|number|boolean)$') { return $t }
    if ($aliases.ContainsKey($t)) { return Normalize-Ts $aliases[$t] $aliases ($depth + 1) $knownInterfaces }
    return $null   # 未知标识符 → fail-closed
}

$failures = @()
$pairSummaries = @()

# ===== 在飞 change 的「## 契约」表（契约先行：表格是形状声明的唯一真源）=====
# 只扫 openspec/changes/*/design.md，跳过 archive：归档后契约由两侧代码承载。
# 表格三列；类型写中性名（string / number / boolean / Array<X> / 另一个 record 名）。
function Get-DesignContractTable([string]$designPath) {
    $text = Get-Content $designPath -Raw -Encoding UTF8
    $m = [regex]::Match($text, '(?ms)^##\s+契约\s*$\r?\n(.*?)(?=^##\s|\z)')
    if (-not $m.Success) { return $null }
    $result = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
    $inTable = $false
    foreach ($line in ($m.Groups[1].Value -split "`r?`n")) {
        if (-not $inTable) {
            # 分隔行 |---|---| 之后才是数据行，借此跳过表头
            if ($line -match '^\s*\|[\s:\-\|]+\|\s*$') { $inTable = $true }
            continue
        }
        if ($line -notmatch '^\s*\|(.+)\|\s*$') { $inTable = $false; continue }
        $cells = @(($matches[1] -split '\|') | ForEach-Object { $_.Trim() })
        if ($cells.Count -lt 3) { continue }
        $iface = $cells[0]; $field = $cells[1]; $specType = $cells[2]
        if ($iface -notmatch '^\w+$') { continue }
        if ($field -notmatch '^[a-z][A-Za-z0-9]*$') { continue }
        if (-not $result.Contains($iface)) {
            $result[$iface] = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
        }
        $result[$iface][$field] = $specType
    }
    return $result
}

$designTables = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
$changesDir = Join-Path $root 'openspec/changes'
if (Test-Path $changesDir) {
    foreach ($ch in @(Get-ChildItem $changesDir -Directory -ErrorAction SilentlyContinue)) {
        if ($ch.Name -eq 'archive') { continue }
        $dp = Join-Path $ch.FullName 'design.md'
        if (-not (Test-Path $dp)) { continue }
        $tbl = Get-DesignContractTable $dp
        if ($null -eq $tbl) { continue }
        $specFieldTotal = 0
        foreach ($k in $tbl.Keys) { $specFieldTotal += $tbl[$k].Count }
        if ($specFieldTotal -eq 0) {
            $failures += "[$($ch.Name)] design.md 有「## 契约」一节但未解析出任何字段（表格格式应为 | 接口 | 字段 | 类型 |）"
            continue
        }
        $designTables[$ch.Name] = $tbl
    }
}

if ($contractPairs.Count -eq 0) {
    Write-Host '契约闸门(10) 失败：受管契约清单为空，没有任何受管对象（防伪）。'
    exit 1
}

foreach ($pair in $contractPairs) {
    $pairName = $pair.Name

    # ---- 收集后端 record 字段（名字 → Java 类型）----
    $backendInterfaces = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
    $backendFieldCount = 0
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
        $text = Get-Content $f.FullName -Raw -Encoding UTF8
        $text = [regex]::Replace($text, '(?s)/\*.*?\*/', ' ')
        $text = [regex]::Replace($text, '(?m)//.*$', ' ')
        foreach ($m in [regex]::Matches($text, '(?s)\brecord\s+(\w+)\s*\((.*?)\)\s*(?:implements[^{]*)?\{')) {
            $interfaceName = $m.Groups[1].Value
            $fields = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
            $paramsText = [regex]::Replace($m.Groups[2].Value, '@\w+(\([^)]*\))?', ' ')
            foreach ($pp in ($paramsText -split ',')) {
                $pp = $pp.Trim()
                if ($pp -match '^(?<type>.+?)\s+(?<name>\w+)$') {
                    $fields[$matches['name']] = $matches['type'].Trim()
                }
            }
            $backendInterfaces[$interfaceName] = $fields
            $backendFieldCount += $fields.Count
        }
    }

    # ---- 后端出现 @JsonProperty 判红 ----
    foreach ($f in $backendFilesList) {
        if ((Get-Content $f.FullName -Raw -Encoding UTF8) -match '@JsonProperty') {
            $failures += "[$pairName] 后端 $($f.Name) 出现 @JsonProperty（字段映射必须与 Java 组件名一致）"
        }
    }

    # ---- 后端字段名 camelCase 判红 ----
    foreach ($interfaceName in $backendInterfaces.Keys) {
        foreach ($name in $backendInterfaces[$interfaceName].Keys) {
            if ($name -cnotmatch '^[a-z][A-Za-z0-9]*$') {
                $failures += "[$pairName] 后端字段 $interfaceName.$name 不是 camelCase"
            }
        }
    }

    # ---- 收集前端 interface 字段（名字 → TS 类型）与 type 别名 ----
    $fePath = Resolve-RepoPath $pair.Frontend
    if (-not (Test-Path $fePath)) {
        $failures += "[$pairName] 前端契约文件缺失：$fePath"
        continue
    }
    $feText = Get-Content $fePath -Raw -Encoding UTF8
    $feAliases = @{}
    foreach ($m in [regex]::Matches($feText, '(?m)^\s*(?:export\s+)?type\s+(\w+)\s*=\s*(.+?)\s*;?\s*$')) {
        $feAliases[$m.Groups[1].Value] = $m.Groups[2].Value.Trim()
    }
    $frontendInterfaces = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
    $frontendFieldCount = 0
    foreach ($blk in [regex]::Matches($feText, '(?s)interface\s+(\w+)\s*\{(.*?)\n\}')) {
        $interfaceName = $blk.Groups[1].Value
        $fields = [System.Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal)
        foreach ($line in ($blk.Groups[2].Value -split "`n")) {
            if ($line -match '^\s*(\w+)\s*\??\s*:\s*([^;]+)') {
                $fields[$matches[1]] = $matches[2].Trim()
            }
        }
        $frontendInterfaces[$interfaceName] = $fields
        $frontendFieldCount += $fields.Count
    }

    # 前端与后端使用相同命名判据，诊断保留接口归属。
    foreach ($interfaceName in $frontendInterfaces.Keys) {
        foreach ($name in $frontendInterfaces[$interfaceName].Keys) {
            if ($name -cnotmatch '^[a-z][A-Za-z0-9]*$') {
                $failures += "[$pairName] 前端字段 $interfaceName.$name 不是 camelCase"
            }
        }
    }

    # ---- 防伪：任一侧解析出空集合即判红 ----
    if ($backendFieldCount -eq 0) { $failures += "[$pairName] 后端未解析出任何 record 字段（解析规则失效）" }
    if ($frontendFieldCount -eq 0) { $failures += "[$pairName] 前端未解析出任何 interface 字段（解析规则失效）" }

    # ---- 令牌字段禁现 ----
    foreach ($side in @(
        @{ Label = '后端'; Interfaces = $backendInterfaces },
        @{ Label = '前端'; Interfaces = $frontendInterfaces }
    )) {
        foreach ($interfaceName in $side.Interfaces.Keys) {
            foreach ($name in $side.Interfaces[$interfaceName].Keys) {
                # 保留禁现规则原有的大小写不敏感行为，不能因精确比对而放宽红线。
                if ($pair.ForbiddenFields -contains $name) {
                    $failures += "[$pairName] $($side.Label)字段 $interfaceName.$name 命中令牌字段禁现红线"
                }
            }
        }
    }

    # 先比较接口身份，再逐个比较共有接口中的字段，避免跨接口覆盖。
    foreach ($interfaceName in $backendInterfaces.Keys) {
        if (-not $frontendInterfaces.Contains($interfaceName)) {
            $failures += "[$pairName] 后端有、前端缺接口：$interfaceName"
        }
    }
    foreach ($interfaceName in $frontendInterfaces.Keys) {
        if (-not $backendInterfaces.Contains($interfaceName)) {
            $failures += "[$pairName] 前端有、后端缺接口：$interfaceName"
        }
    }

    # ---- 字段名双向比对 ----
    $typeChecked = 0
    foreach ($interfaceName in $backendInterfaces.Keys) {
        if (-not $frontendInterfaces.Contains($interfaceName)) { continue }
        $backendTypes = $backendInterfaces[$interfaceName]
        $frontendTypes = $frontendInterfaces[$interfaceName]
        foreach ($name in $backendTypes.Keys) {
            if (-not $frontendTypes.Contains($name)) { $failures += "[$pairName] 后端有、前端缺字段：$interfaceName.$name" }
        }
        foreach ($name in $frontendTypes.Keys) {
            if (-not $backendTypes.Contains($name)) { $failures += "[$pairName] 前端有、后端缺字段：$interfaceName.$name" }
        }

        # ---- 字段类型比对（共有字段，经映射/归一后）----
        foreach ($name in $backendTypes.Keys) {
            if (-not $frontendTypes.Contains($name)) { continue }
            $javaType = $backendTypes[$name]
            $tsType = $frontendTypes[$name]
            $knownRecords = @($backendInterfaces.Keys)
            $knownInterfaces = @($frontendInterfaces.Keys)
            $mapped = Map-JavaToTs $javaType $knownRecords
            if (-not $mapped) {
                $failures += "[$pairName] 字段 $interfaceName.$name：后端类型 $javaType 不在 Java↔TS 映射表内（fail-closed）"
                continue
            }
            $normalized = Normalize-Ts $tsType $feAliases 0 $knownInterfaces
            if (-not $normalized) {
                $failures += "[$pairName] 字段 $interfaceName.$name：前端类型 $tsType 无法归一化（fail-closed）"
                continue
            }
            $typeChecked++
            if ($mapped -ne $normalized) {
                $failures += "[$pairName] 字段 $interfaceName.$name 类型不一致：后端 $javaType→$mapped，前端 $tsType→$normalized"
            }
        }
    }

    # ---- 契约表比对（仅当某份在飞 change 的「## 契约」声明了本组涉及的接口）----
    foreach ($chName in $designTables.Keys) {
        $tbl = $designTables[$chName]
        foreach ($iface in $tbl.Keys) {
            $hasBackend = $backendInterfaces.Contains($iface)
            $hasFrontend = $frontendInterfaces.Contains($iface)
            if (-not $hasBackend -and -not $hasFrontend) { continue }
            $specFields = $tbl[$iface]
            $beFields = if ($hasBackend) { $backendInterfaces[$iface] } else { $null }
            $feFields = if ($hasFrontend) { $frontendInterfaces[$iface] } else { $null }

            foreach ($f in $specFields.Keys) {
                if ($null -ne $beFields -and -not $beFields.Contains($f)) {
                    $failures += "[$chName] 契约声明 $iface.$f，后端未实现"
                }
                if ($null -ne $feFields -and -not $feFields.Contains($f)) {
                    $failures += "[$chName] 契约声明 $iface.$f，前端未实现"
                }
            }
            if ($null -ne $beFields) {
                foreach ($f in $beFields.Keys) {
                    if (-not $specFields.Contains($f)) { $failures += "[$chName] 后端字段 $iface.$f 未在契约表中声明" }
                }
            }
            if ($null -ne $feFields) {
                foreach ($f in $feFields.Keys) {
                    if (-not $specFields.Contains($f)) { $failures += "[$chName] 前端字段 $iface.$f 未在契约表中声明" }
                }
            }

            foreach ($f in $specFields.Keys) {
                $specType = $specFields[$f].Trim()
                if ($null -ne $beFields -and $beFields.Contains($f)) {
                    $mapped = Map-JavaToTs $beFields[$f] @($backendInterfaces.Keys)
                    if ($mapped -and $mapped -cne $specType) {
                        $failures += "[$chName] 类型不一致 $iface.$f：契约表 $specType，后端 $($beFields[$f])→$mapped"
                    }
                }
                if ($null -ne $feFields -and $feFields.Contains($f)) {
                    $normalized = Normalize-Ts $feFields[$f] $feAliases 0 @($frontendInterfaces.Keys)
                    if ($normalized -and $normalized -cne $specType) {
                        $failures += "[$chName] 类型不一致 $iface.$f：契约表 $specType，前端 $($feFields[$f])→$normalized"
                    }
                }
            }
        }
    }

    $pairSummaries += "[$pairName] 后端 record $($backendInterfaces.Count) 个 / 前端 interface $($frontendInterfaces.Count) 个；后端字段 $backendFieldCount 个 / 前端字段 $frontendFieldCount 个（按接口累计）；类型比对 $typeChecked 个共有字段全部一致（含 @JsonProperty/camelCase/令牌禁现检查）"
}

if ($failures.Count -gt 0) {
    Write-Host '契约闸门(10) 失败：'
    foreach ($x in ($failures | Select-Object -Unique)) { Write-Host "  - $x" }
    exit 1
}

Write-Host "契约闸门(10) 通过：受管 $($contractPairs.Count) 组契约，字段名 + 类型双向一致。"
if ($designTables.Count -gt 0) {
    Write-Host "  （契约表比对：$($designTables.Keys -join '、') 的「## 契约」已与两侧逐字段比对）"
}
foreach ($s in $pairSummaries) { Write-Host "  $s" }
exit 0
