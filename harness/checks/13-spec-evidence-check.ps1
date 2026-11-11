<#
    闸门 13-spec-evidence-check：Scenario 证据账本
    因：Scenario 证据散落在单测与 E2E 中，无法保证每条都被显式分类（2026-11-06 提交 41f0b52）

    openspec/specs/ 下每条 Scenario 必须在 docs/spec-evidence.json 中落入三类之一：
      verified            -> 有可核验证据（gate / test / e2e / runner）
      deferred            -> 显式欠账，必须带 reason / registeredOn / unlock
      historicallyCovered -> 历史按能力级来源覆盖，尚未逐条评估

    引用可写成 <path>#<anchor>：锚点必须是该文件中真实存在的标识符（Java 方法名）
    或文本片段（vitest 的 it 描述），用于堵住「文件存在、其中并无对应测试」。

    账本可选 evidencePolicy.methodAnchorPatterns（缺省时行为不变）：
      标题命中这些关键词的场景，其 test 引用必须带锚点。不强制证据层级：
      确定性模拟交错、两个实例共用一个存储都能由单测有效验证，强制 e2e 只会逼人造假。

    闸门只保证「登记齐全、引用真实、锚点存在、强度达标」，不证明行为正确。
    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$specsRoot = 'openspec/specs'
$ledgerPath = 'docs/spec-evidence.json'
$validKinds = @('gate', 'test', 'e2e', 'runner')

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

function Get-MapKeys {
    param($Map)
    if ($null -eq $Map) { return @() }
    return @($Map.PSObject.Properties | ForEach-Object { $_.Name })
}

function Get-MapValue {
    param($Map, [string]$Key)
    if ($null -eq $Map) { return $null }
    return $Map.PSObject.Properties[$Key].Value
}

function Split-EvidenceRef {
    param([string]$RawRef)
    $hashIndex = $RawRef.IndexOf('#')
    if ($hashIndex -lt 0) {
        return @{ Path = $RawRef; Anchor = $null }
    }
    return @{
        Path   = $RawRef.Substring(0, $hashIndex)
        Anchor = $RawRef.Substring($hashIndex + 1)
    }
}

function Test-EvidenceRef {
    param($Ref, [string]$Where)
    $kind = [string]$Ref.kind
    $rawRef = [string]$Ref.ref
    if (-not ($validKinds -contains $kind)) {
        Add-Problem "未知证据类型：$Where -> $kind"
        return
    }
    if ([string]::IsNullOrWhiteSpace($rawRef)) {
        Add-Problem "证据引用为空：$Where"
        return
    }
    $parts = Split-EvidenceRef -RawRef $rawRef
    $path = $parts.Path
    $anchor = $parts.Anchor
    if ([string]::IsNullOrWhiteSpace($path)) {
        Add-Problem "证据引用缺少路径：$Where -> $rawRef"
        return
    }
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Problem "引用不存在：$Where -> $path"
        return
    }
    if (-not [string]::IsNullOrWhiteSpace($anchor)) {
        $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        if ($anchor -match '^[A-Za-z_][A-Za-z0-9_]*$') {
            $pattern = '(?<![A-Za-z0-9_])' + [regex]::Escape($anchor) + '(?![A-Za-z0-9_])'
            if ($content -notmatch $pattern) {
                Add-Problem "引用锚点不存在：$Where -> $rawRef"
            }
        }
        elseif (-not $content.Contains($anchor)) {
            Add-Problem "引用锚点不存在：$Where -> $rawRef"
        }
    }
    switch ($kind) {
        'gate' {
            if ($path -notmatch '^harness/checks/\d\d-.+\.ps1$') {
                Add-Problem "gate 引用不在 harness/checks：$Where -> $path"
            }
        }
        'e2e' {
            if ($path -notmatch '^docs/e2e/.+\.spec\.ts$') {
                Add-Problem "e2e 引用不在 docs/e2e：$Where -> $path"
            }
        }
        'runner' {
            if ($path -ne 'harness/run-all.ps1' -and $path -notmatch '^\.github/workflows/.+\.ya?ml$') {
                Add-Problem "runner 引用不合法：$Where -> $path"
            }
        }
    }
}

function Get-ScenarioKeys {
    param([string]$SpecFile)
    $keys = New-Object System.Collections.ArrayList
    $currentRequirement = $null
    foreach ($line in (Get-Content -LiteralPath $SpecFile -Encoding UTF8)) {
        if ($line -match '^### Requirement:\s*(.+?)\s*$') {
            $currentRequirement = $Matches[1]
            continue
        }
        if ($line -match '^#### Scenario:\s*(.+?)\s*$') {
            $key = $Matches[1]
            if ($currentRequirement) { $key = "$currentRequirement / $key" }
            [void]$keys.Add($key)
        }
    }
    return $keys
}

if (-not (Test-Path -LiteralPath $ledgerPath -PathType Leaf)) {
    Write-Host "13-spec-evidence-check FAILED: $ledgerPath 不存在"
    exit 1
}

try {
    $ledger = Get-Content -LiteralPath $ledgerPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
catch {
    Write-Host "13-spec-evidence-check FAILED: $ledgerPath 不是合法 JSON（$($_.Exception.Message)）"
    exit 1
}

if ($null -eq $ledger.capabilities) {
    Write-Host '13-spec-evidence-check FAILED: 账本缺少 capabilities'
    exit 1
}

$methodAnchorPatterns = @()
if ($null -ne $ledger.evidencePolicy) {
    $methodAnchorPatterns = @((Get-MapValue -Map $ledger.evidencePolicy -Key 'methodAnchorPatterns') |
        Where-Object { $null -ne $_ } | ForEach-Object { [string]$_ })
}

$specDirs = @(Get-ChildItem -LiteralPath $specsRoot -Directory | Sort-Object Name)
if ($specDirs.Count -eq 0) {
    Write-Host "13-spec-evidence-check FAILED: $specsRoot 下没有主规格"
    exit 1
}

$specNames = @($specDirs | ForEach-Object { $_.Name })
$ledgerNames = @(Get-MapKeys -Map $ledger.capabilities)

foreach ($name in $specNames) {
    if ($ledgerNames -notcontains $name) { Add-Problem "能力未登记：$name" }
}
foreach ($name in $ledgerNames) {
    if ($specNames -notcontains $name) { Add-Problem "账本残留能力：$name" }
}

$totalVerified = 0
$totalDeferred = 0
$totalHistorical = 0
$totalRefs = 0

foreach ($name in $specNames) {
    if ($ledgerNames -notcontains $name) { continue }

    $cap = Get-MapValue -Map $ledger.capabilities -Key $name
    $specFile = Join-Path (Join-Path $specsRoot $name) 'spec.md'
    if (-not (Test-Path -LiteralPath $specFile -PathType Leaf)) {
        Add-Problem "缺少主规格：$name"
        continue
    }

    $specSet = @{}
    foreach ($title in (Get-ScenarioKeys -SpecFile $specFile)) {
        if ($specSet.ContainsKey($title)) {
            Add-Problem "规格内重复 Scenario 键：$name / $title"
            continue
        }
        $specSet[$title] = $true
    }

    $sources = @($cap.sources | Where-Object { $null -ne $_ })
    foreach ($ref in $sources) {
        Test-EvidenceRef -Ref $ref -Where "$name/sources"
        $totalRefs++
    }

    # 函数返回单元素数组时 PowerShell 会展开为标量，必须用 @() 重新包装，
    # 否则后续的 $a + $b + $c 会退化成字符串拼接，把多个键压成一个。
    $verifiedNames = @(Get-MapKeys -Map $cap.verified)
    $deferredNames = @(Get-MapKeys -Map $cap.deferred)
    $historical = @($cap.historicallyCovered | Where-Object { $null -ne $_ })

    $classified = @{}
    foreach ($title in @($verifiedNames + $deferredNames + $historical)) {
        if ($classified.ContainsKey($title)) {
            Add-Problem "重复登记：$name / $title"
            continue
        }
        $classified[$title] = $true
    }

    foreach ($title in $classified.Keys) {
        if (-not $specSet.ContainsKey($title)) {
            Add-Problem "账本指向不存在的 Scenario 键：$name / $title"
        }
    }
    foreach ($title in $specSet.Keys) {
        if (-not $classified.ContainsKey($title)) {
            Add-Problem "Scenario 未登记：$name / $title"
        }
    }

    foreach ($title in $verifiedNames) {
        $refs = @((Get-MapValue -Map $cap.verified -Key $title) | Where-Object { $null -ne $_ })
        if ($refs.Count -eq 0) {
            Add-Problem "verified 缺少证据引用：$name / $title"
        }
        foreach ($ref in $refs) {
            Test-EvidenceRef -Ref $ref -Where "$name/verified/$title"
            $totalRefs++
        }

        $anchorHits = @($methodAnchorPatterns | Where-Object { $title -like "*$_*" })
        if ($anchorHits.Count -gt 0) {
            foreach ($ref in @($refs | Where-Object { [string]$_.kind -eq 'test' })) {
                if (([string]$ref.ref) -notmatch '#') {
                    Add-Problem "高风险场景的 test 引用缺少方法锚点：$name / $title -> $($ref.ref)（命中：$($anchorHits -join ',')）"
                }
            }
        }
    }

    foreach ($title in $deferredNames) {
        $item = Get-MapValue -Map $cap.deferred -Key $title
        foreach ($field in @('reason', 'registeredOn', 'unlock')) {
            $value = [string](Get-MapValue -Map $item -Key $field)
            if ([string]::IsNullOrWhiteSpace($value)) {
                Add-Problem "欠账缺字段：$name / $title / $field"
            }
        }
        $date = [string](Get-MapValue -Map $item -Key 'registeredOn')
        if (-not [string]::IsNullOrWhiteSpace($date) -and $date -notmatch '^\d{4}-\d{2}-\d{2}$') {
            Add-Problem "欠账日期格式不合法：$name / $title / $date"
        }
    }

    $totalVerified += $verifiedNames.Count
    $totalDeferred += $deferredNames.Count
    $totalHistorical += $historical.Count
}

if ($problems.Count -gt 0) {
    Write-Host "13-spec-evidence-check FAILED: 发现 $($problems.Count) 处问题"
    foreach ($problem in $problems) {
        Write-Host "  - $problem"
    }
    exit 1
}

Write-Host "13-spec-evidence-check PASSED: $($specNames.Count) 个能力；verified $totalVerified / deferred $totalDeferred / historicallyCovered $totalHistorical；证据引用 $totalRefs 个"
exit 0
