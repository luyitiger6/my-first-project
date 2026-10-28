# 02-test.ps1
#
# 闸门 2：测试
# 单元测试验证行为，@SpringBootTest 验证容器能真实装配。
# 这一层是「契约」的机器可读版本：spec 里的场景最终要落到这里。
#
# 凭据注入：application.yml 里只写环境变量名，测试侧同样不存明文。
# 本闸门按 06 / 09 的同一约定，从「发布 8806 / 6606 端口的容器」读出凭据，
# 只在本进程内注入，跑完恢复原值。读不到就失败——测试连不上真实库，
# 等于这一闸门根本没跑（AGENTS.md §9：mvn test 直连真实实例）。
#
# 注意：本检查不允许 -DskipTests，跳过测试等于拆掉护栏。

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location (Join-Path $projectRoot 'backend')

function Get-ContainerByPort([int]$Port) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $null }
    return (docker ps --filter "publish=$Port" --format "{{.Names}}" 2>$null | Select-Object -First 1)
}

function Get-ContainerEnvValue([string]$Container, [string]$Name) {
    if (-not $Container) { return $null }
    $lines = docker inspect $Container --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null
    $line = $lines | Where-Object { $_ -like "$Name=*" } | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Substring($Name.Length + 1)
}

# redis 官方镜像不把密码放进环境变量，而是写在启动命令的 --requirepass 后面。
function Get-RedisRequirepass([int]$Port) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $null }
    $commandLine = (docker ps --no-trunc --filter "publish=$Port" --format "{{.Command}}" 2>$null | Select-Object -First 1)
    if ($commandLine -match '--requirepass\s+(\S+)') {
        return ($Matches[1] -replace '^["'']|["'']$', '')
    }
    return $null
}

$restore = @{}

function Set-ProcessEnv([string]$Name, [string]$Value, [string]$Purpose, [switch]$AllowEmpty) {
    if ([string]::IsNullOrEmpty($Value) -and -not $AllowEmpty) {
        throw "$Purpose unavailable: $Name is neither set in the environment nor discoverable from the container"
    }
    $current = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($null -eq $current) {
        $restore[$Name] = $null
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
        $shown = if ([string]::IsNullOrEmpty($Value)) { '(empty)' } else { $Purpose }
        Write-Host "  $Name <- $shown" -ForegroundColor DarkGray
    } else {
        Write-Host "  $Name already provided, keeping it" -ForegroundColor DarkGray
    }
}

$code = 1
try {
    Write-Host 'Preparing credentials for mvn test' -ForegroundColor DarkGray

    $dbContainer = Get-ContainerByPort 8806
    $dbPassword = $env:WANDERCHAIN_DB_PASSWORD
    if ([string]::IsNullOrEmpty($dbPassword)) { $dbPassword = Get-ContainerEnvValue $dbContainer 'MYSQL_ROOT_PASSWORD' }
    Set-ProcessEnv 'WANDERCHAIN_DB_PASSWORD' $dbPassword 'MySQL password from container publishing 8806'

    $dbUser = $env:WANDERCHAIN_DB_USER
    if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = 'root' }
    Set-ProcessEnv 'WANDERCHAIN_DB_USER' $dbUser 'MySQL user (default root)'

    $redisPassword = $env:WANDERCHAIN_REDIS_PASSWORD
    if ([string]::IsNullOrEmpty($redisPassword)) { $redisPassword = Get-RedisRequirepass 6606 }
    # 无密码的 Redis 是合法部署，注入空串而不是失败。
    Set-ProcessEnv 'WANDERCHAIN_REDIS_PASSWORD' $redisPassword 'Redis requirepass from container publishing 6606' -AllowEmpty

    # 测试专用签名密钥：不是生产凭据，只用于让 AuthProperties 的必填校验在测试中通过。
    $jwtSecret = $env:WANDERCHAIN_JWT_SECRET
    if ([string]::IsNullOrEmpty($jwtSecret)) { $jwtSecret = 'test-only-jwt-secret-not-for-production' }
    Set-ProcessEnv 'WANDERCHAIN_JWT_SECRET' $jwtSecret 'test-only signing key'

    Write-Host 'Running: mvn -B test' -ForegroundColor DarkGray
    & mvn -B test
    $code = $LASTEXITCODE
} catch {
    Write-Host "Test gate FAILED: $($_.Exception.Message)" -ForegroundColor Red
    $code = 1
} finally {
    foreach ($name in $restore.Keys) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
}

if ($code -ne 0) {
    Write-Host 'Test gate FAILED' -ForegroundColor Red
    exit 1
}

Write-Host 'Test gate passed' -ForegroundColor Green
exit 0
