<#
    闸门 12-skills-sync-check：自研技能真源与三处适配副本逐字节一致
    因：自研技能改动只同步部分副本时，各工具里的 agent 会拿到不同版本（2026-11-06 提交 bc74c71）

    AGENTS.md §5 约定：.agents/skills/ 是自研技能的编写真源，逐字节分发到
    .claude/skills/、.qoder/skills/、.opencode/skills/。本闸门把这条约定
    变成可验证事实：文件相对路径集合与每个文件 SHA256 都必须相同。

    范围边界：openspec-* 技能由 openspec init / openspec update 按各工具适配
    生成，天然存在跨层差异，不纳入比对；其余目录（自研技能）自动纳入，
    新增技能无需修改本脚本。

    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$sourceRoot = Join-Path $projectRoot '.agents/skills'
$targetRoots = @('.claude/skills', '.qoder/skills', '.opencode/skills')

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

function Get-FileManifest {
    param([string]$Root)
    $manifest = @{}
    $files = @(Get-ChildItem -LiteralPath $Root -Recurse -File)
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($Root.Length).TrimStart('\', '/')
        $manifest[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    }
    return $manifest
}

if (-not (Test-Path -LiteralPath $sourceRoot)) {
    Write-Host '12-skills-sync-check FAILED: .agents/skills 不存在'
    exit 1
}

$skills = @(Get-ChildItem -LiteralPath $sourceRoot -Directory |
    Where-Object { $_.Name -notlike 'openspec-*' } |
    Sort-Object Name)

if ($skills.Count -eq 0) {
    Write-Host '12-skills-sync-check FAILED: .agents/skills 下没有自研技能目录'
    exit 1
}

foreach ($skill in $skills) {
    $sourceManifest = Get-FileManifest -Root $skill.FullName
    foreach ($targetRoot in $targetRoots) {
        $display = "$targetRoot/$($skill.Name)"
        $targetDir = Join-Path (Join-Path $projectRoot $targetRoot) $skill.Name
        if (-not (Test-Path -LiteralPath $targetDir)) {
            Add-Problem "缺少副本目录：$display"
            continue
        }

        $targetManifest = Get-FileManifest -Root $targetDir
        foreach ($relative in $sourceManifest.Keys) {
            if (-not $targetManifest.ContainsKey($relative)) {
                Add-Problem "缺少文件：$display/$relative"
            }
            elseif ($targetManifest[$relative] -ne $sourceManifest[$relative]) {
                Add-Problem "内容不一致：$display/$relative"
            }
        }
        foreach ($relative in $targetManifest.Keys) {
            if (-not $sourceManifest.ContainsKey($relative)) {
                Add-Problem "多出文件：$display/$relative"
            }
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host "12-skills-sync-check FAILED: 发现 $($problems.Count) 处差异"
    foreach ($problem in $problems) {
        Write-Host "  - $problem"
    }
    exit 1
}

Write-Host "12-skills-sync-check PASSED: $($skills.Count) 个自研技能与 $($targetRoots.Count) 处副本逐字节一致"
exit 0
