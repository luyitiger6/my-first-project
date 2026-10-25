<#
.SYNOPSIS
    Harness 总闸门：子模块 -> 编译 -> 测试 -> 静态红线 -> 前端 -> 改名 -> 迁移，任一失败立即返回非 0。

    执行顺序按 checks/ 文件名排序：
      00-submodule-check  子模块已初始化且与父仓库 gitlink 一致
      01-compile          后端编译
      02-test             后端测试 + 容器装配
      03-static-guard     伪造绿灯红线
      04-frontend         前端安装 / 构建 / 测试
      05-scaffold-check   工作区改名演练 + 旧身份残留扫描
      06-flyway           既有 127.0.0.1:8806 MySQL 8 + 专用 schema 迁移

.DESCRIPTION
    这套脚本存在的唯一目的是「拥有否决权」。
    AI 可以声称自己做完了，但只有这里返回 0 才算真的做完。
    人类审阅与 CI 都只认退出码，不看日志措辞。

.EXAMPLE
    powershell -File harness\run-all.ps1
#>
[CmdletBinding()]
param(
    # 默认遇错即停；排查问题时可用 -ContinueOnError 跑完全部检查
    [switch]$ContinueOnError
)

$ErrorActionPreference = 'Stop'

$harnessDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $harnessDir
Set-Location $projectRoot

Write-Host "Harness root : $projectRoot" -ForegroundColor DarkGray
Write-Host "Started at   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray

$checks = Get-ChildItem (Join-Path $harnessDir 'checks') -Filter '*.ps1' -File | Sort-Object Name
if (-not $checks) {
    Write-Host 'No checks found under harness\checks' -ForegroundColor Red
    exit 1
}

$results = @()
foreach ($check in $checks) {
    Write-Host ''
    Write-Host "==> $($check.Name)" -ForegroundColor Cyan

    $sw = [Diagnostics.Stopwatch]::StartNew()
    # 用独立进程执行，确保每个检查的退出码互不污染
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $check.FullName
    $code = $LASTEXITCODE
    $sw.Stop()

    if ($null -eq $code) { $code = 0 }

    $results += [pscustomobject]@{
        Check    = $check.BaseName
        ExitCode = $code
        Seconds  = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    }

    if ($code -ne 0 -and -not $ContinueOnError) { break }
}

Write-Host ''
Write-Host '===== Harness Summary =====' -ForegroundColor Cyan
foreach ($r in $results) {
    if ($r.ExitCode -eq 0) {
        Write-Host ("  [PASS] {0} ({1}s)" -f $r.Check, $r.Seconds) -ForegroundColor Green
    }
    else {
        Write-Host ("  [FAIL] {0} (exit {1}, {2}s)" -f $r.Check, $r.ExitCode, $r.Seconds) -ForegroundColor Red
    }
}

$failed = @($results | Where-Object { $_.ExitCode -ne 0 })
$skipped = @($checks | Where-Object { $c = $_.BaseName; -not ($results | Where-Object { $_.Check -eq $c }) })

if ($failed.Count -gt 0) {
    Write-Host ''
    Write-Host ("RESULT: BLOCKED - $($failed.Count) check(s) failed") -ForegroundColor Red
    if ($skipped.Count -gt 0) {
        Write-Host ("        ($($skipped.Count) check(s) not run because of early stop)") -ForegroundColor DarkYellow
    }
    exit 1
}

Write-Host ''
Write-Host 'RESULT: ALL CHECKS PASSED' -ForegroundColor Green
exit 0
