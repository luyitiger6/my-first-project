<#
    闸门 14-change-scope-check：在飞 change 的粒度上限
    因：在飞 change 粒度失控时，单轮验证成本会无上限增长（2026-11-07 提交 86e70e0）

    对 openspec/changes/ 下每个在飞 change（不含 archive）统计三项：
      能力数    -> specs/ 下含 spec.md 的目录路径去重计数 <= 2
      任务数    -> tasks.md 中复选框条目 <= 30
      Scenario  -> delta 规格中 #### Scenario: 标题 <= 60

    任一超限时必须提供 scope-exception.md，且 Reason / RegisteredOn / Expires
    三字段非空、两个日期为 YYYY-MM-DD、Expires 不早于判定当日。
    例外是到期失效的欠账，不是永久豁免。

    归档目录中的历史 change 不追溯。
    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$changesRoot = 'openspec/changes'
$maxCapabilities = 2
$maxTasks = 30
$maxScenarios = 60

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

function Get-CapabilityPaths {
    param([string]$ChangeDir)
    $specsDir = Join-Path $ChangeDir 'specs'
    if (-not (Test-Path -LiteralPath $specsDir -PathType Container)) { return @() }
    $paths = New-Object System.Collections.ArrayList
    foreach ($file in (Get-ChildItem -LiteralPath $specsDir -Recurse -Filter 'spec.md' -File)) {
        $rel = $file.DirectoryName.Substring($specsDir.Length).TrimStart([char[]]@('\', '/'))
        $normalized = $rel.Replace('\', '/')
        if (-not $paths.Contains($normalized)) { [void]$paths.Add($normalized) }
    }
    return @($paths | Sort-Object)
}

function Get-TaskCount {
    param([string]$ChangeDir)
    $tasksFile = Join-Path $ChangeDir 'tasks.md'
    if (-not (Test-Path -LiteralPath $tasksFile -PathType Leaf)) { return 0 }
    return @(Get-Content -LiteralPath $tasksFile -Encoding UTF8 | Where-Object { $_ -match '^\s*-\s*\[[ xX]\]' }).Count
}

function Get-ScenarioCount {
    param([string]$ChangeDir)
    $specsDir = Join-Path $ChangeDir 'specs'
    if (-not (Test-Path -LiteralPath $specsDir -PathType Container)) { return 0 }
    $count = 0
    foreach ($file in (Get-ChildItem -LiteralPath $specsDir -Recurse -Filter 'spec.md' -File)) {
        $count += @(Get-Content -LiteralPath $file.FullName -Encoding UTF8 | Where-Object { $_ -match '^#### Scenario:' }).Count
    }
    return $count
}

function Read-Exception {
    param([string]$ChangeDir)
    $file = Join-Path $ChangeDir 'scope-exception.md'
    $result = @{ Exists = $false; Reason = $null; RegisteredOn = $null; Expires = $null }
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $result }
    $result.Exists = $true
    foreach ($line in (Get-Content -LiteralPath $file -Encoding UTF8)) {
        if ($line -match '^\s*[-*]?\s*Reason\s*[:：]\s*(.*)$') { $result.Reason = $Matches[1].Trim(); continue }
        if ($line -match '^\s*[-*]?\s*RegisteredOn\s*[:：]\s*(.*)$') { $result.RegisteredOn = $Matches[1].Trim(); continue }
        if ($line -match '^\s*[-*]?\s*Expires\s*[:：]\s*(.*)$') { $result.Expires = $Matches[1].Trim(); continue }
    }
    return $result
}

if (-not (Test-Path -LiteralPath $changesRoot -PathType Container)) {
    Write-Host "14-change-scope-check FAILED: $changesRoot 不存在"
    exit 1
}

$changeDirs = @(Get-ChildItem -LiteralPath $changesRoot -Directory | Where-Object { $_.Name -ne 'archive' } | Sort-Object Name)
$summaries = New-Object System.Collections.ArrayList

foreach ($dir in $changeDirs) {
    $caps = @(Get-CapabilityPaths -ChangeDir $dir.FullName)
    $tasks = Get-TaskCount -ChangeDir $dir.FullName
    $scenarios = Get-ScenarioCount -ChangeDir $dir.FullName

    $over = New-Object System.Collections.ArrayList
    if ($caps.Count -gt $maxCapabilities) {
        [void]$over.Add("能力 $($caps.Count) > $maxCapabilities（$($caps -join ', ')）")
    }
    if ($tasks -gt $maxTasks) {
        [void]$over.Add("tasks $tasks > $maxTasks")
    }
    if ($scenarios -gt $maxScenarios) {
        [void]$over.Add("scenarios $scenarios > $maxScenarios")
    }

    $exceptionNote = ''
    if ($over.Count -gt 0) {
        $ex = Read-Exception -ChangeDir $dir.FullName
        if (-not $ex.Exists) {
            Add-Problem "change 粒度过大：$($dir.Name)；$($over -join '；')；未提供 scope-exception.md"
        }
        else {
            $missing = @()
            foreach ($field in @('Reason', 'RegisteredOn', 'Expires')) {
                if ([string]::IsNullOrWhiteSpace([string]$ex[$field])) { $missing += $field }
            }
            if ($missing.Count -gt 0) {
                Add-Problem "例外缺字段：$($dir.Name) -> $($missing -join ', ')"
            }
            else {
                $badDate = $false
                foreach ($field in @('RegisteredOn', 'Expires')) {
                    if ([string]$ex[$field] -notmatch '^\d{4}-\d{2}-\d{2}$') {
                        Add-Problem "例外日期格式不合法：$($dir.Name) -> $field=$($ex[$field])"
                        $badDate = $true
                    }
                }
                if (-not $badDate) {
                    $expires = [datetime]::ParseExact([string]$ex.Expires, 'yyyy-MM-dd', $null)
                    if ($expires -lt (Get-Date).Date) {
                        Add-Problem "例外已过期：$($dir.Name) -> Expires=$($ex.Expires)"
                    }
                    else {
                        $exceptionNote = '（例外放行）'
                    }
                }
            }
        }
    }

    [void]$summaries.Add("$($dir.Name) 能力 $($caps.Count) / tasks $tasks / scenarios $scenarios$exceptionNote")
}

if ($problems.Count -gt 0) {
    Write-Host "14-change-scope-check FAILED: 发现 $($problems.Count) 处问题"
    foreach ($problem in $problems) {
        Write-Host "  - $problem"
    }
    exit 1
}

if ($summaries.Count -eq 0) {
    Write-Host '14-change-scope-check PASSED: 无在飞 change'
    exit 0
}

Write-Host "14-change-scope-check PASSED: $($summaries.Count) 个在飞 change；上限 能力 $maxCapabilities / tasks $maxTasks / scenarios $maxScenarios"
foreach ($line in $summaries) {
    Write-Host "  - $line"
}
exit 0
