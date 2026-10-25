# 06-flyway.ps1
# 复用 127.0.0.1:8806 上的既有 MySQL 8 实例，在专用 schema ai_chat_gate 上验证 Flyway 迁移。
# 不创建/删除容器，不修改 green-note 业务库；通过 exit 0，失败 exit 1，无交互提问。

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$dbHost = if ($env:FLYWAY_DB_HOST) { $env:FLYWAY_DB_HOST } else { '127.0.0.1' }
$dbPort = if ($env:FLYWAY_DB_PORT) { [int]$env:FLYWAY_DB_PORT } else { 8806 }
$dbUser = if ($env:FLYWAY_DB_USER) { $env:FLYWAY_DB_USER } else { 'root' }
$dbName = if ($env:FLYWAY_DB_NAME) { $env:FLYWAY_DB_NAME } else { 'ai_chat_gate' }
$dbPassword = $env:FLYWAY_DB_PASSWORD
$businessSchema = 'green-note'

$coreTables = @('users', 'conversations', 'messages', 'usage_records')
$expectedTables = @($coreTables + 'flyway_schema_history')
$expectedIndexes = @(
  'uk_users_public_id',
  'uk_users_active_email',
  'uk_conversations_public_id',
  'idx_conversations_user_active',
  'uk_messages_public_id',
  'uk_messages_conv_seq',
  'uk_messages_conv_request',
  'idx_messages_conv_id',
  'idx_messages_parent',
  'uk_usage_public_id',
  'idx_usage_user_time',
  'idx_usage_conversation_time',
  'idx_usage_message'
)
$expectedConstraints = @(
  'ck_users_status', 'ck_users_version',
  'fk_conversations_user', 'ck_conversations_status', 'ck_conversations_message_count', 'ck_conversations_version',
  'fk_messages_conversation', 'fk_messages_parent',
  'ck_messages_role', 'ck_messages_content_type', 'ck_messages_seq', 'ck_messages_prompt_tokens', 'ck_messages_completion_tokens',
  'fk_usage_user', 'fk_usage_conversation', 'fk_usage_message',
  'ck_usage_prompt_tokens', 'ck_usage_completion_tokens', 'ck_usage_cost'
)

function Fail([string]$Message) {
  Write-Host "06-flyway FAILED: $Message" -ForegroundColor Red
  exit 1
}

if ($dbName -notmatch '^ai_chat_gate(_[a-z0-9]+)?$') {
  Fail "FLYWAY_DB_NAME must be ai_chat_gate or ai_chat_gate_<suffix>; got '$dbName'"
}

# 1. TCP 可达性检查：只检查既有实例，不启动任何容器。
try {
  $tcp = New-Object System.Net.Sockets.TcpClient
  $async = $tcp.BeginConnect($dbHost, $dbPort, $null, $null)
  if (-not $async.AsyncWaitHandle.WaitOne(5000)) {
    $tcp.Close()
    Fail "MySQL is not reachable at ${dbHost}:${dbPort} (timeout)"
  }
  $tcp.EndConnect($async)
  $tcp.Close()
} catch {
  Fail "MySQL is not reachable at ${dbHost}:${dbPort}: $($_.Exception.Message)"
}

# 2. 通过发布端口找到既有容器：用于 docker exec 断言，以及本机开发时发现 root 密码。
$container = $null
if (Get-Command docker -ErrorAction SilentlyContinue) {
  $container = (docker ps --filter "publish=$dbPort" --format "{{.Names}}" 2>$null | Select-Object -First 1)
}

if (-not $dbPassword -and $container) {
  $envLines = docker inspect $container --format '{{range .Config.Env}}{{println .}}{{end}}' 2>$null
  $pwLine = $envLines | Where-Object { $_ -like 'MYSQL_ROOT_PASSWORD=*' } | Select-Object -First 1
  if ($pwLine) {
    $dbPassword = $pwLine.Substring('MYSQL_ROOT_PASSWORD='.Length)
  }
}

if (-not $dbPassword) {
  Fail 'FLYWAY_DB_PASSWORD is not set and no MYSQL_ROOT_PASSWORD could be discovered from the container publishing the port'
}

function Invoke-Sql {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [switch]$NoDatabase
  )

  if ($container) {
    $dockerArgs = @('exec', '-e', "MYSQL_PWD=$dbPassword", $container, 'mysql', '-u', $dbUser, '-N', '-B', '-e', $Sql)
    if (-not $NoDatabase) { $dockerArgs += $dbName }
    $output = & docker @dockerArgs 2>&1
    $code = $LASTEXITCODE
  } else {
    if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
      Fail 'Neither a Docker container publishing the port nor a local mysql client is available for schema assertions'
    }
    $oldPwd = $env:MYSQL_PWD
    $env:MYSQL_PWD = $dbPassword
    try {
      $mysqlArgs = @('-h', $dbHost, '-P', [string]$dbPort, '-u', $dbUser, '-N', '-B', '-e', $Sql)
      if (-not $NoDatabase) { $mysqlArgs += $dbName }
      $output = & mysql @mysqlArgs 2>&1
      $code = $LASTEXITCODE
    } finally {
      if ($null -eq $oldPwd) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
      } else {
        $env:MYSQL_PWD = $oldPwd
      }
    }
  }

  if ($code -ne 0) {
    Fail "SQL failed (exit $code): $($output -join ' | ')"
  }
  return @($output)
}

# 3. 确认是 MySQL 8，并记录业务库表集合；结束后必须保持不变。
$version = @(Invoke-Sql 'SELECT VERSION();' -NoDatabase)[0]
if (-not $version -or -not $version.StartsWith('8.')) {
  Fail "MySQL 8 required; got '$version'"
}

$businessBefore = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;" -NoDatabase) -join ',')

# 4. 只重建专用 schema，绝不触碰业务库。
$quotedDb = '`' + $dbName + '`'
Invoke-Sql "DROP DATABASE IF EXISTS $quotedDb; CREATE DATABASE $quotedDb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" -NoDatabase | Out-Null

# 5. Flyway 迁移。
$url = "jdbc:mysql://${dbHost}:${dbPort}/${dbName}?useSSL=false&allowPublicKeyRetrieval=true&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=utf8"
# Windows 的 mvn.cmd 会把 URL 中的 & 当作命令分隔符；改用 Flyway 环境变量传参，避免命令行拆分与密码出现在进程参数中。
$env:FLYWAY_URL = $url
$env:FLYWAY_USER = $dbUser
$env:FLYWAY_PASSWORD = $dbPassword
$mvnArgs = @('-B', '-f', 'backend/pom.xml', 'flyway:migrate')

& mvn @mvnArgs
if ($LASTEXITCODE -ne 0) {
  Fail "Flyway migrate failed with exit code $LASTEXITCODE"
}

# 6. 结构断言：表、索引、约束、生成列、审计时间列。
$tables = @(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$dbName' ORDER BY table_name;" -NoDatabase)
foreach ($table in $expectedTables) {
  if ($tables -notcontains $table) { Fail "missing table: $table" }
}

$indexes = @(Invoke-Sql "SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema='$dbName';" -NoDatabase)
foreach ($index in $expectedIndexes) {
  if ($indexes -notcontains $index) { Fail "missing index: $index" }
}

$constraints = @(Invoke-Sql "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='$dbName' AND constraint_type IN ('CHECK', 'FOREIGN KEY');" -NoDatabase)
foreach ($constraint in $expectedConstraints) {
  if ($constraints -notcontains $constraint) { Fail "missing constraint: $constraint" }
}

$generated = @(Invoke-Sql "SELECT column_name FROM information_schema.columns WHERE table_schema='$dbName' AND extra LIKE '%GENERATED%';" -NoDatabase)
foreach ($column in @('active_email', 'total_tokens')) {
  if ($generated -notcontains $column) { Fail "missing generated column: $column" }
}

$createdAtTables = @(Invoke-Sql "SELECT table_name FROM information_schema.columns WHERE table_schema='$dbName' AND column_name='created_at';" -NoDatabase)
foreach ($table in $coreTables) {
  if ($createdAtTables -notcontains $table) { Fail "missing created_at on $table" }
}

$historyOk = [int](@(Invoke-Sql 'SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1;')[0])
$historyFailed = [int](@(Invoke-Sql 'SELECT COUNT(*) FROM flyway_schema_history WHERE success = 0;')[0])
if ($historyOk -lt 1) { Fail 'flyway_schema_history has no successful migration' }
if ($historyFailed -ne 0) { Fail "flyway_schema_history contains $historyFailed failed migration(s)" }

# 7. 幂等：再次迁移，历史成功条数不得变化。
& mvn @mvnArgs
if ($LASTEXITCODE -ne 0) {
  Fail "second Flyway migrate failed with exit code $LASTEXITCODE"
}
$historyAfter = [int](@(Invoke-Sql 'SELECT COUNT(*) FROM flyway_schema_history WHERE success = 1;')[0])
if ($historyAfter -ne $historyOk) {
  Fail "idempotency check failed: history count changed from $historyOk to $historyAfter"
}

# 8. 业务库与容器均未被改动。
$businessAfter = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;" -NoDatabase) -join ',')
if ($businessAfter -ne $businessBefore) {
  Fail "business schema '$businessSchema' changed during the gate"
}

Write-Host "06-flyway PASSED: $dbName on ${dbHost}:${dbPort}; tables, indexes, constraints, generated columns verified; idempotent" -ForegroundColor Green
exit 0
