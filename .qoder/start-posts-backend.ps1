$ErrorActionPreference = 'Stop'

# 仅为本轮本地启动注入环境；不保存或打印任何凭据。
$mysqlName = docker ps --filter publish=8806 --format '{{.Names}}' | Select-Object -First 1
$redisName = docker ps --filter publish=6606 --format '{{.Names}}' | Select-Object -First 1
if (-not $mysqlName -or -not $redisName) { throw '既有 MySQL 或 Redis 容器不可用。' }
$mysql = (docker inspect $mysqlName | ConvertFrom-Json)[0]
$redis = (docker inspect $redisName | ConvertFrom-Json)[0]
if ($LASTEXITCODE -ne 0) { throw '无法读取既有容器配置。' }

$rootPassword = $mysql.Config.Env | Where-Object { $_ -like 'MYSQL_ROOT_PASSWORD=*' } | Select-Object -First 1
$redisArgs = @($redis.Config.Cmd)
$passIndex = [Array]::IndexOf($redisArgs, '--requirepass')
if (-not $rootPassword -or $passIndex -lt 0 -or $passIndex + 1 -ge $redisArgs.Count) {
  throw '既有容器配置未提供可用的运行凭据。'
}
$env:WANDERCHAIN_DB_USER = 'root'
$env:WANDERCHAIN_DB_PASSWORD = $rootPassword.Substring('MYSQL_ROOT_PASSWORD='.Length)
$env:WANDERCHAIN_REDIS_PASSWORD = $redisArgs[$passIndex + 1]

# 用户已确认临时随机 JWT 密钥；仅存在于本进程及其子进程。
$bytes = New-Object byte[] 64
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$env:WANDERCHAIN_JWT_SECRET = [Convert]::ToBase64String($bytes)

$projectRoot = Split-Path -Parent $PSScriptRoot
& mvn -f (Join-Path $projectRoot 'backend/pom.xml') spring-boot:run
exit $LASTEXITCODE
