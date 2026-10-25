<#
    闸门 0：子模块就绪
    在任何编译、测试或前端检查之前，确认 backend/frontend 两个 submodule
    已初始化，且检出提交与父仓库记录的 gitlink 一致。

    本检查只读：不执行 git submodule update，不访问网络，不提问。
    未初始化时以退出码 1 结束，并输出可直接执行的修复命令。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

$gitmodules = Join-Path $projectRoot '.gitmodules'
if (-not (Test-Path -LiteralPath $gitmodules)) {
    Add-Problem '.gitmodules 不存在'
}

$expectedByPath = @{}

foreach ($path in @('backend', 'frontend')) {
    $configuredPath = & git config -f $gitmodules --get "submodule.$path.path" 2>$null
    $configuredUrl = & git config -f $gitmodules --get "submodule.$path.url" 2>$null

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($configuredPath)) {
        Add-Problem ".gitmodules 缺少 submodule.$path.path"
    }
    elseif ($configuredPath.Trim() -ne $path) {
        Add-Problem ".gitmodules 中 $path 的 path 为 '$($configuredPath.Trim())'，预期 '$path'"
    }

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($configuredUrl)) {
        Add-Problem ".gitmodules 缺少 submodule.$path.url"
    }

    $stage = & git ls-files --stage -- $path 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($stage)) {
        Add-Problem "父仓库未记录 $path 的 gitlink"
    }
    else {
        $fields = ($stage.Trim() -split '\s+')
        if ($fields.Count -lt 2 -or $fields[0] -ne '160000') {
            Add-Problem "父仓库中 $path 不是 gitlink（mode=$($fields[0])）"
        }
        else {
            $expectedByPath[$path] = $fields[1]
        }
    }

    $marker = if ($path -eq 'backend') { 'pom.xml' } else { 'package.json' }
    $markerPath = Join-Path $projectRoot (Join-Path $path $marker)
    if (-not (Test-Path -LiteralPath $markerPath)) {
        Add-Problem "$path/$marker 不存在（子模块未初始化或工作树为空）"
    }

    $inside = & git -C $path rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0 -or $inside.Trim() -ne 'true') {
        Add-Problem "$path 不是有效的 git 工作树"
        continue
    }

    $head = & git -C $path rev-parse HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
        Add-Problem "$path 无法读取 HEAD"
    }
    elseif ($expectedByPath.ContainsKey($path)) {
        $actual = $head.Trim()
        $expected = $expectedByPath[$path]
        if ($actual -ne $expected) {
            Add-Problem "$path 检出提交 $actual 与父仓库 gitlink $expected 不一致"
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host "00-submodule-check FAILED - $($problems.Count) problem(s):" -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "  - $problem" -ForegroundColor Red
    }
    Write-Host ''
    Write-Host '修复: git submodule update --init --recursive' -ForegroundColor Yellow
    exit 1
}

Write-Host '00-submodule-check PASSED: backend/frontend 子模块已初始化且与 gitlink 一致' -ForegroundColor Green
exit 0
