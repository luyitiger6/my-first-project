<#
    闸门 1/3：编译
    只验证「代码能否被编译」，不验证行为对错。
    与测试拆开的原因：编译失败和逻辑错误是两类问题，混在一起会让归因变模糊。
#>
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# Maven 项目根已迁入 backend/（change: restructure-backend-layout）
Set-Location (Join-Path $projectRoot 'backend')

Write-Host 'Running: mvn -B -DskipTests compile' -ForegroundColor DarkGray
& mvn -B -DskipTests compile
$code = $LASTEXITCODE

if ($code -ne 0) {
    Write-Host 'Compile gate FAILED' -ForegroundColor Red
    exit 1
}

Write-Host 'Compile gate passed' -ForegroundColor Green
exit 0
