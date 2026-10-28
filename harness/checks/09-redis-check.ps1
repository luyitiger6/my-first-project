# 09-redis-check.ps1
#
# 缓存闸门：只验证 127.0.0.1:6606 上的既有 Redis 可达、凭据正确、约定的 db index 可选中。
# 不写业务键、不建容器、不清库——6606 是多项目共用实例，其它 db 里的键不归本仓库管。
# 通过 exit 0，失败 exit 1，无交互提问（AGENTS.md §8 约定）。

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$redisHost = if ($env:SCHEMA_REDIS_HOST) { $env:SCHEMA_REDIS_HOST } else { '127.0.0.1' }
$redisPort = if ($env:SCHEMA_REDIS_PORT) { [int]$env:SCHEMA_REDIS_PORT } else { 6606 }
$redisDb = if ($env:SCHEMA_REDIS_DB) { [int]$env:SCHEMA_REDIS_DB } else { 3 }
$redisPassword = $env:SCHEMA_REDIS_PASSWORD

function Fail([string]$Message) {
  Write-Host "09-redis-check FAILED: $Message" -ForegroundColor Red
  exit 1
}

# 1. TCP 可达性检查：只检查既有实例，不启动任何容器。
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $async = $tcp.BeginConnect($redisHost, $redisPort, $null, $null)
  if (-not $async.AsyncWaitHandle.WaitOne(5000)) {
    $tcp.Close()
    Fail "Redis is not reachable at ${redisHost}:${redisPort} (timeout)"
  }
  $tcp.EndConnect($async)
  $tcp.Close()
} catch {
  Fail "Redis is not reachable at ${redisHost}:${redisPort}: $($_.Exception.Message)"
}

# 2. 通过发布端口找到既有容器：用于 docker exec，以及本机开发时发现 requirepass。
$container = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $container = (docker ps --filter "publish=$redisPort" --format "{{.Names}}" 2>$null | Select-Object -First 1)
}

if (-not $redisPassword -and $container) {
  # redis 官方镜像不把密码放进环境变量，而是写在启动命令的 --requirepass 后面。
  $commandLine = (docker ps --no-trunc --filter "publish=$redisPort" --format "{{.Command}}" 2>$null | Select-Object -First 1)
  if ($commandLine -match '--requirepass\s+(\S+)') {
    $redisPassword = $Matches[1] -replace '^["'']|["'']$', ''
  }
}

function Invoke-Redis {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  if ($container) {
    $dockerArgs = @('exec')
    if ($redisPassword) { $dockerArgs += @('-e', "REDISCLI_AUTH=$redisPassword") }
    $dockerArgs += @($container, 'redis-cli', '--no-auth-warning', '-n', [string]$redisDb)
    $dockerArgs += $Arguments
    $output = & docker @dockerArgs 2>&1
    $code = $LASTEXITCODE
  } else {
    if (-not (Get-Command redis-cli -ErrorAction SilentlyContinue)) {
      Fail 'Neither a Docker container publishing the port nor a local redis-cli is available for the cache check'
    }
    $oldAuth = $env:REDISCLI_AUTH
    $env:REDISCLI_AUTH = $redisPassword
    try {
      $output = & redis-cli --no-auth-warning -n $redisDb @Arguments 2>&1
      $code = $LASTEXITCODE
    } finally {
      if ($null -eq $oldAuth) {
        Remove-Item Env:REDISCLI_AUTH -ErrorAction SilentlyContinue
      } else {
        $env:REDISCLI_AUTH = $oldAuth
      }
    }
  }

  if ($code -ne 0) {
    Fail "redis command failed (exit $code): $($output -join ' | ')"
  }
  return @($output)
}

# 3. 认证与连通：不带密码时这里会得到 NOAUTH，凭据错则是 WRONGPASS，两种都必须算失败。
$pong = ((Invoke-Redis -Arguments @('PING')) -join '').Trim()
if ($pong -ne 'PONG') {
  Fail "PING on db $redisDb returned '$pong' (expected PONG)"
}

# 4. 确认选中的确实是约定的 db，而不是碰巧连上了 db 0。
$clientInfo = (@(Invoke-Redis -Arguments @('CLIENT', 'INFO')) -join ' ')
if ($clientInfo -notmatch "db=$redisDb(\s|$)") {
  Fail "connection is not on db $redisDb`: $clientInfo"
}

# 5. 只读探测键数量：既证明该 db 可读，也把「是否已被别的项目占用」暴露出来。
# 5. 只读探测键数量，仅作为信息输出：业务键写入后这里必然非 0，不能拿它当失败条件。
#    真正把本项目的键与其它项目隔开的是约定前缀 wc:，不是 db index 本身。
$keyCount = [int]((Invoke-Redis -Arguments @('DBSIZE'))[0])

Write-Host "09-redis-check PASSED: Redis at ${redisHost}:${redisPort} db $redisDb reachable and authenticated (db currently holds $keyCount key(s))" -ForegroundColor Green
exit 0
