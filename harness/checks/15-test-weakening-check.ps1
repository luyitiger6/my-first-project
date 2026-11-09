<#
    闸门 15-test-weakening-check：测试弱化
    因：跳过语法被 03 拦住后，删断言、并用例、删测试文件仍能全绿（2026-11-08 提交 bda9259）
    03-static-guard 拦的是「用跳过语法让测试消失」，拦不住下面这些：
      1. 删掉几条断言，测试照旧全绿
      2. 把两个用例并成一个，覆盖面缩小但数量看不出少
      3. 直接删掉测试文件

    它们的共同点是：测试仍然全绿，护栏的实际强度却被调低了。
    判定方式：比较测试文件在基线与 HEAD 的用例数与断言数，任一下降即失败。

    必须分别进三个仓库比较：backend 与 frontend 是 git submodule，
    主工作区的 diff 只看得到 gitlink，看不到子模块内部的任何文件变化。

    基线优先取 origin/main（PR 场景更完整），取不到时回退到 HEAD^。
    merge commit 放行：合并本身不产生新的测试弱化，硬查会把整条历史算进来。

    本闸门只查「测试变弱」，查不出「改业务代码去适配写错的测试」——
    那需要 Stage 1 的 spec 对账，机械检查看不见意图。
#>
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host 'git not found' -ForegroundColor Red
    exit 1
}

$targets = @(
    @{ Name = 'root'; Dir = $projectRoot; Match = '\.(test|spec)\.tsx?$' },
    @{ Name = 'backend'; Dir = (Join-Path $projectRoot 'backend'); Match = '^src/test/.*\.java$' },
    @{ Name = 'frontend'; Dir = (Join-Path $projectRoot 'frontend'); Match = '\.(test|spec)\.tsx?$' }
)

$casePattern = '\b(it|test)\s*\(|@Test\b'
$assertPattern = '\bexpect\s*\(|\bassert[A-Za-z]*\b|Assert\.'

function Get-TestMetric([string[]]$lines) {
    $cases = 0
    $asserts = 0
    foreach ($line in $lines) {
        if ($line -match $casePattern) { $cases++ }
        if ($line -match $assertPattern) { $asserts++ }
    }
    return @{ Cases = $cases; Asserts = $asserts }
}

$failures = New-Object System.Collections.ArrayList
$compared = 0
$skipped = New-Object System.Collections.ArrayList

foreach ($t in $targets) {
    $name = $t['Name']
    $dir = $t['Dir']
    $match = $t['Match']

    if (-not (Test-Path $dir)) {
        [void]$skipped.Add("$name（目录不存在）")
        continue
    }

    & git -C $dir rev-parse --git-dir 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        [void]$skipped.Add("$name（不是 git 仓库）")
        continue
    }

    $parents = @((& git -C $dir rev-list --parents -n 1 HEAD) -split '\s+' | Where-Object { $_ })
    $mergeBase = $null
    if ($parents.Count -gt 2) {
        # merge commit：用第一父做基线，比较的是「这次合并带进来的改动」。
        # pull_request 事件默认检出的就是 merge commit，跳过它等于放过整个主工作区。
        $mergeBase = $parents[1]
    }

    $base = $mergeBase
    & git -C $dir rev-parse --verify --quiet origin/main 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $mb = & git -C $dir merge-base HEAD origin/main 2>$null
        if ($LASTEXITCODE -eq 0 -and $mb) { $base = "$mb".Trim() }
    }
    if (-not $base) {
        & git -C $dir rev-parse --verify --quiet 'HEAD^' 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            [void]$skipped.Add("$name（无基线）")
            continue
        }
        $base = "$(& git -C $dir rev-parse 'HEAD^')".Trim()
    }

    $changed = @(& git -C $dir diff --name-only $base HEAD 2>$null)
    if ($LASTEXITCODE -ne 0) {
        [void]$failures.Add("[$name] git diff 失败（基线 $base）")
        continue
    }

    $testFiles = @($changed | Where-Object { $_ -match $match })

    foreach ($file in $testFiles) {
        $oldText = @(& git -C $dir show "$($base):$file" 2>$null)
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  + [$name] $file（新增，无基线可比）" -ForegroundColor DarkGray
            continue
        }

        $newPath = Join-Path $dir $file
        # -LiteralPath：路径里的 [...] 是 Next.js 动态段命名（如 app/api/[...path]/），
        # 用通配符语义的 Test-Path 会把它当字符集，把存在的文件误报成已删除。
        if (-not (Test-Path -LiteralPath $newPath)) {
            [void]$failures.Add("[$name] $file  测试文件被删除")
            continue
        }

        $old = Get-TestMetric $oldText
        $new = Get-TestMetric @([IO.File]::ReadAllLines($newPath))
        $compared++

        if ($new.Cases -lt $old.Cases) {
            [void]$failures.Add("[$name] $file  用例数 $($old.Cases) -> $($new.Cases)")
        }
        if ($new.Asserts -lt $old.Asserts) {
            [void]$failures.Add("[$name] $file  断言数 $($old.Asserts) -> $($new.Asserts)")
        }
    }
}

if ($skipped.Count -gt 0) {
    Write-Host "  skipped: $($skipped -join '; ')" -ForegroundColor DarkGray
}

if ($failures.Count -gt 0) {
    Write-Host "Test weakening FAILED - $($failures.Count) regression(s):" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    Write-Host '  测试变弱等于护栏变弱。确属重构的，在 change 的 design.md 里写明理由后人工放行。' -ForegroundColor Yellow
    exit 1
}

Write-Host "Test weakening passed ($compared test file(s) compared)" -ForegroundColor Green
exit 0
