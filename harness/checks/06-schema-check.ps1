# 06-schema-check.ps1
#
# 建表闸门：复用 127.0.0.1:8806 上的既有 MySQL 8 实例，验证两个独立 schema 的建表脚本。
#   ai_chat_gate —— AI 会话四表（backend/src/main/resources/db/ai-chat/schema.sql）
#   wanderchain  —— 认证两表（backend/src/main/resources/schema.sql）
# 这道闸门守的从来不是某个迁移工具，而是「表真的建对了」：表名、索引名、约束名、生成列、审计列、重复执行无副作用。
# 不创建/删除容器，不修改 green-note 业务库；通过 exit 0，失败 exit 1，无交互提问。

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$dbHost = if ($env:SCHEMA_DB_HOST) { $env:SCHEMA_DB_HOST } else { '127.0.0.1' }
$dbPort = if ($env:SCHEMA_DB_PORT) { [int]$env:SCHEMA_DB_PORT } else { 8806 }
$dbUser = if ($env:SCHEMA_DB_USER) { $env:SCHEMA_DB_USER } else { 'root' }
$aiChatDb = if ($env:SCHEMA_DB_NAME) { $env:SCHEMA_DB_NAME } else { 'ai_chat_gate' }
$authDb = 'wanderchain'
$dbPassword = $env:SCHEMA_DB_PASSWORD
$businessSchema = 'green-note'

function Fail([string]$Message) {
  Write-Host "06-schema-check FAILED: $Message" -ForegroundColor Red
  exit 1
}

$expectations = @{}
$expectations[$aiChatDb] = @{
  Script      = 'backend/src/main/resources/db/ai-chat/schema.sql'
  Tables      = @('users', 'conversations', 'messages', 'usage_records')
  Indexes     = @(
    'uk_users_public_id', 'uk_users_active_email',
    'uk_conversations_public_id', 'idx_conversations_user_active',
    'uk_messages_public_id', 'uk_messages_conv_seq', 'uk_messages_conv_request',
    'idx_messages_conv_id', 'idx_messages_parent',
    'uk_usage_public_id', 'idx_usage_user_time', 'idx_usage_conversation_time', 'idx_usage_message'
  )
  Constraints = @(
    'ck_users_status', 'ck_users_version',
    'fk_conversations_user', 'ck_conversations_status', 'ck_conversations_message_count', 'ck_conversations_version',
    'fk_messages_conversation', 'fk_messages_parent',
    'ck_messages_role', 'ck_messages_content_type', 'ck_messages_seq', 'ck_messages_prompt_tokens', 'ck_messages_completion_tokens',
    'fk_usage_user', 'fk_usage_conversation', 'fk_usage_message',
    'ck_usage_prompt_tokens', 'ck_usage_completion_tokens', 'ck_usage_cost'
  )
  Generated   = @('active_email', 'total_tokens')
  CreatedAt   = @('users', 'conversations', 'messages', 'usage_records')
}
$expectations[$authDb] = @{
  Script      = 'backend/src/main/resources/schema.sql'
  Tables      = @('accounts', 'auth_sessions')
  Indexes     = @('uk_accounts_public_id', 'uk_accounts_active_email', 'uk_auth_sessions_jti', 'idx_auth_sessions_account', 'idx_auth_sessions_expires')
  Constraints = @('ck_accounts_status', 'ck_accounts_token_version', 'ck_accounts_version', 'fk_auth_sessions_account', 'ck_auth_sessions_expires')
  Generated   = @('active_email')
  CreatedAt   = @('accounts')
}
$databases = @($aiChatDb, $authDb)

if ($aiChatDb -notmatch '^ai_chat_gate(_[a-z0-9]+)?$') {
  Fail "SCHEMA_DB_NAME must be ai_chat_gate or ai_chat_gate_<suffix>; got '$aiChatDb'"
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
  Fail 'SCHEMA_DB_PASSWORD is not set and no MYSQL_ROOT_PASSWORD could be discovered from the container publishing the port'
}

function Invoke-Sql {
  param(
    [Parameter(Mandatory = $true)][string]$Sql,
    [string]$Database
  )

  if ($container) {
    $dockerArgs = @('exec', '-e', "MYSQL_PWD=$dbPassword", $container, 'mysql', '-u', $dbUser, '-N', '-B', '--default-character-set=utf8mb4')
    if ($Database) { $dockerArgs += $Database }
    $dockerArgs += @('-e', $Sql)
    $output = & docker @dockerArgs 2>&1
    $code = $LASTEXITCODE
  } else {
    if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
      Fail 'Neither a Docker container publishing the port nor a local mysql client is available for schema assertions'
    }
    $oldPwd = $env:MYSQL_PWD
    $env:MYSQL_PWD = $dbPassword
    try {
      $mysqlArgs = @('-h', $dbHost, '-P', [string]$dbPort, '-u', $dbUser, '-N', '-B', '--default-character-set=utf8mb4')
      if ($Database) { $mysqlArgs += $Database }
      $mysqlArgs += @('-e', $Sql)
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

function Invoke-SqlFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Database
  )

  $fullPath = Join-Path $projectRoot $Path
  if (-not (Test-Path -LiteralPath $fullPath)) { Fail "schema script not found: $Path" }
  # 整个脚本作为单个参数传给 mysql：不经过 PowerShell 管道，避免 Windows 下的编码转换。
  $sql = Get-Content -Raw -Encoding UTF8 -LiteralPath $fullPath
  if (-not $sql) { Fail "schema script is empty: $Path" }
  Invoke-Sql -Sql $sql -Database $Database | Out-Null
}

# 3. 确认是 MySQL 8，并记录业务库表集合；结束后必须保持不变。
$version = @(Invoke-Sql 'SELECT VERSION();')[0]
if (-not $version -or -not $version.StartsWith('8.')) {
  Fail "MySQL 8 required; got '$version'"
}

$businessBefore = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;") -join ',')

# 4. 只重建两个专用 schema，绝不触碰业务库。
foreach ($db in $databases) {
  $quotedDb = '`' + $db + '`'
  Invoke-Sql "DROP DATABASE IF EXISTS $quotedDb; CREATE DATABASE $quotedDb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" | Out-Null
}

# 5. 执行建表脚本。
foreach ($db in $databases) {
  Invoke-SqlFile -Path $expectations[$db].Script -Database $db
}

# 6. 结构断言：表、索引、约束、生成列、审计时间列。
foreach ($db in $databases) {
  $spec = $expectations[$db]

  $tables = @(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$db' ORDER BY table_name;")
  foreach ($table in $spec.Tables) {
    if ($tables -notcontains $table) { Fail "missing table: $db.$table" }
  }

  $indexes = @(Invoke-Sql "SELECT DISTINCT index_name FROM information_schema.statistics WHERE table_schema='$db';")
  foreach ($index in $spec.Indexes) {
    if ($indexes -notcontains $index) { Fail "missing index: $db.$index" }
  }

  $constraints = @(Invoke-Sql "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='$db' AND constraint_type IN ('CHECK', 'FOREIGN KEY');")
  foreach ($constraint in $spec.Constraints) {
    if ($constraints -notcontains $constraint) { Fail "missing constraint: $db.$constraint" }
  }

  $generated = @(Invoke-Sql "SELECT column_name FROM information_schema.columns WHERE table_schema='$db' AND extra LIKE '%GENERATED%';")
  foreach ($column in $spec.Generated) {
    if ($generated -notcontains $column) { Fail "missing generated column: $db.$column" }
  }

  $createdAtTables = @(Invoke-Sql "SELECT table_name FROM information_schema.columns WHERE table_schema='$db' AND column_name='created_at';")
  foreach ($table in $spec.CreatedAt) {
    if ($createdAtTables -notcontains $table) { Fail "missing created_at on $db.$table" }
  }
}

# 7. 幂等：脚本再跑一遍，不得报错，也不得重建任何表（create_time 是重建的硬证据）。
function Get-TableFingerprint([string]$Database) {
  return (@(Invoke-Sql "SELECT CONCAT(table_name, ':', DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s')) FROM information_schema.tables WHERE table_schema='$Database' ORDER BY table_name;") -join '|')
}

$fingerprintBefore = @{}
foreach ($db in $databases) { $fingerprintBefore[$db] = Get-TableFingerprint $db }

# 表重建会把 create_time 刷新到当前秒；隔一秒再跑，才能把「没重建」和「同一秒内重建」区分开。
Start-Sleep -Seconds 2

foreach ($db in $databases) {
  Invoke-SqlFile -Path $expectations[$db].Script -Database $db
}

foreach ($db in $databases) {
  $fingerprintAfter = Get-TableFingerprint $db
  if ($fingerprintAfter -ne $fingerprintBefore[$db]) {
    Fail "idempotency check failed on '$db': tables were recreated`n  before: $($fingerprintBefore[$db])`n  after:  $fingerprintAfter"
  }
}

# 8. 业务库与容器均未被改动。
$businessAfter = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;") -join ',')
if ($businessAfter -ne $businessBefore) {
  Fail "business schema '$businessSchema' changed during the gate"
}

$summary = ($databases | ForEach-Object { $expectations[$_].Tables.Count.ToString() + ' tables in ' + $_ }) -join ', '
Write-Host "06-schema-check PASSED: $summary on ${dbHost}:${dbPort}; tables, indexes, constraints, generated columns verified; idempotent" -ForegroundColor Green
exit 0
