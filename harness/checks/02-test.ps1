<#
    闸门 2/3：测试
    单元测试验证行为，@SpringBootTest 验证容器能真实装配。
    这一层是「契约」的机器可读版本：spec 里的场景最终要落到这里。

    注意：本检查不允许 -DskipTests，跳过测试等于拆掉护栏。
#>
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
# Maven 项目根已迁入 backend/（change: restructure-backend-layout）
Set-Location (Join-Path $projectRoot 'backend')

Write-Host 'Running: mvn -B test' -ForegroundColor DarkGray
& mvn -B test
$code = $LASTEXITCODE

if ($code -ne 0) {
    Write-Host 'Test gate FAILED' -ForegroundColor Red
    exit 1
}

Write-Host 'Test gate passed' -ForegroundColor Green
exit 0
