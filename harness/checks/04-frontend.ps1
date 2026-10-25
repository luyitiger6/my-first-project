<#
    闸门 4/5：前端
    三步链：依赖可复现安装（npm ci）→ 生产构建（npm run build，Next.js 构建内含 TypeScript 类型检查）
    → 组件与代理测试（npm run test，vitest + jsdom）。
    任一步退出码非 0 即整体失败；不做交互式提问（AGENTS.md §8 约定）。
#>
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location (Join-Path $projectRoot 'frontend')

Write-Host 'Running: npm ci' -ForegroundColor DarkGray
& npm ci
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host 'Frontend gate FAILED at npm ci' -ForegroundColor Red
    exit 1
}

Write-Host 'Running: npm run build' -ForegroundColor DarkGray
& npm run build
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host 'Frontend gate FAILED at npm run build' -ForegroundColor Red
    exit 1
}

Write-Host 'Running: npm run test' -ForegroundColor DarkGray
& npm run test
$code = $LASTEXITCODE
if ($code -ne 0) {
    Write-Host 'Frontend gate FAILED at npm run test' -ForegroundColor Red
    exit 1
}

Write-Host 'Frontend gate passed' -ForegroundColor Green
exit 0
