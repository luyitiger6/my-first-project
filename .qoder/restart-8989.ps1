$ErrorActionPreference = 'Stop'

# 仅为本轮本地启动注入环境；不保存或打印任何凭据。
$mysqlName = docker ps --filter publish=8806 --format '{{.Names}}' | Select-Object -First 1
$redisName = docker ps --filter publish=6606 --format '{{.Names}}' | Select-Object -First 1
if (-not $mysqlName -or -not $redisName) { throw 'container missing' }
$mysql = (docker inspect $mysqlName | ConvertFrom-Json)[0]
$redis = (docker inspect $redisName | ConvertFrom-Json)[0]
$rootPassword = $mysql.Config.Env | Where-Object { $_ -like 'MYSQL_ROOT_PASSWORD=*' } | Select-Object -First 1
$redisArgs = @($redis.Config.Cmd)
$passIndex = [Array]::IndexOf($redisArgs, '--requirepass')
$env:WANDERCHAIN_DB_USER = 'root'
$env:WANDERCHAIN_DB_PASSWORD = $rootPassword.Substring('MYSQL_ROOT_PASSWORD='.Length)
$env:WANDERCHAIN_REDIS_PASSWORD = $redisArgs[$passIndex + 1]

$bytes = New-Object byte[] 64
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$env:WANDERCHAIN_JWT_SECRET = [Convert]::ToBase64String($bytes)

# 显式钉住端口：避免从父 shell 继承到降级实验用过的 SPRING_DATA_REDIS_PORT。
$env:SPRING_DATA_REDIS_PORT = '6606'
$env:SERVER_PORT = '8989'

Set-Location 'd:\my-first-project'
& mvn -f backend/pom.xml spring-boot:run 2>&1 | Out-File -FilePath "$env:TEMP\wc-8989.log" -Encoding UTF8
