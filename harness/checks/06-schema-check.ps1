# 06-schema-check.ps1
#
# 寤鸿〃闂搁棬锛氬鐢?127.0.0.1:8806 涓婄殑鏃㈡湁 MySQL 8 瀹炰緥锛岄獙璇佷袱涓嫭绔?schema 鐨勫缓琛ㄨ剼鏈€?
#   ai_chat_gate 鈥斺€?AI 浼氳瘽鍥涜〃锛坆ackend/src/main/resources/db/ai-chat/schema.sql锛?
#   wanderchain  鈥斺€?璁よ瘉涓よ〃锛坆ackend/src/main/resources/schema.sql锛?
# 杩欓亾闂搁棬瀹堢殑浠庢潵涓嶆槸鏌愪釜杩佺Щ宸ュ叿锛岃€屾槸銆岃〃鐪熺殑寤哄浜嗐€嶏細琛ㄥ悕銆佺储寮曞悕銆佺害鏉熷悕銆佺敓鎴愬垪銆佸璁″垪銆侀噸澶嶆墽琛屾棤鍓綔鐢ㄣ€?
# 涓嶅垱寤?鍒犻櫎瀹瑰櫒锛屼笉淇敼 green-note 涓氬姟搴擄紱閫氳繃 exit 0锛屽け璐?exit 1锛屾棤浜や簰鎻愰棶銆?

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
  Tables      = @('accounts', 'auth_sessions', 'posts')
  Indexes     = @(
    'uk_accounts_public_id', 'uk_accounts_active_email',
    'uk_auth_sessions_jti', 'idx_auth_sessions_account', 'idx_auth_sessions_expires',
    'uk_posts_public_id', 'idx_posts_feed', 'idx_posts_author'
  )
  Constraints = @(
    'ck_accounts_status', 'ck_accounts_token_version', 'ck_accounts_version',
    'fk_auth_sessions_account', 'ck_auth_sessions_expires',
    'fk_posts_author', 'ck_posts_status', 'ck_posts_version'
  )
  Generated   = @('active_email')
  CreatedAt   = @('accounts', 'posts')
}
$databases = @($aiChatDb, $authDb)

if ($aiChatDb -notmatch '^ai_chat_gate(_[a-z0-9]+)?$') {
  Fail "SCHEMA_DB_NAME must be ai_chat_gate or ai_chat_gate_<suffix>; got '$aiChatDb'"
}

# 1. TCP 鍙揪鎬ф鏌ワ細鍙鏌ユ棦鏈夊疄渚嬶紝涓嶅惎鍔ㄤ换浣曞鍣ㄣ€?
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

# 2. 閫氳繃鍙戝竷绔彛鎵惧埌鏃㈡湁瀹瑰櫒锛氱敤浜?docker exec 鏂█锛屼互鍙婃湰鏈哄紑鍙戞椂鍙戠幇 root 瀵嗙爜銆?
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
  # 鏁翠釜鑴氭湰浣滀负鍗曚釜鍙傛暟浼犵粰 mysql锛氫笉缁忚繃 PowerShell 绠￠亾锛岄伩鍏?Windows 涓嬬殑缂栫爜杞崲銆?
  $sql = Get-Content -Raw -Encoding UTF8 -LiteralPath $fullPath
  if (-not $sql) { Fail "schema script is empty: $Path" }
  Invoke-Sql -Sql $sql -Database $Database | Out-Null
}

# 3. 纭鏄?MySQL 8锛屽苟璁板綍涓氬姟搴撹〃闆嗗悎锛涚粨鏉熷悗蹇呴』淇濇寔涓嶅彉銆?
$version = @(Invoke-Sql 'SELECT VERSION();')[0]
if (-not $version -or -not $version.StartsWith('8.')) {
  Fail "MySQL 8 required; got '$version'"
}

$businessBefore = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;") -join ',')

# 4. 鍙噸寤轰袱涓笓鐢?schema锛岀粷涓嶈Е纰颁笟鍔″簱銆?
foreach ($db in $databases) {
  $quotedDb = '`' + $db + '`'
  Invoke-Sql "DROP DATABASE IF EXISTS $quotedDb; CREATE DATABASE $quotedDb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;" | Out-Null
}

# 5. 鎵ц寤鸿〃鑴氭湰銆?
foreach ($db in $databases) {
  Invoke-SqlFile -Path $expectations[$db].Script -Database $db
}

# 6. 缁撴瀯鏂█锛氳〃銆佺储寮曘€佺害鏉熴€佺敓鎴愬垪銆佸璁℃椂闂村垪銆?
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

# 7. 骞傜瓑锛氳剼鏈啀璺戜竴閬嶏紝涓嶅緱鎶ラ敊锛屼篃涓嶅緱閲嶅缓浠讳綍琛紙create_time 鏄噸寤虹殑纭瘉鎹級銆?
function Get-TableFingerprint([string]$Database) {
  return (@(Invoke-Sql "SELECT CONCAT(table_name, ':', DATE_FORMAT(create_time, '%Y-%m-%d %H:%i:%s')) FROM information_schema.tables WHERE table_schema='$Database' ORDER BY table_name;") -join '|')
}

$fingerprintBefore = @{}
foreach ($db in $databases) { $fingerprintBefore[$db] = Get-TableFingerprint $db }

# 琛ㄩ噸寤轰細鎶?create_time 鍒锋柊鍒板綋鍓嶇锛涢殧涓€绉掑啀璺戯紝鎵嶈兘鎶娿€屾病閲嶅缓銆嶅拰銆屽悓涓€绉掑唴閲嶅缓銆嶅尯鍒嗗紑銆?
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

# 8. 涓氬姟搴撲笌瀹瑰櫒鍧囨湭琚敼鍔ㄣ€?
$businessAfter = (@(Invoke-Sql "SELECT table_name FROM information_schema.tables WHERE table_schema='$businessSchema' ORDER BY table_name;") -join ',')
if ($businessAfter -ne $businessBefore) {
  Fail "business schema '$businessSchema' changed during the gate"
}

$summary = ($databases | ForEach-Object { $expectations[$_].Tables.Count.ToString() + ' tables in ' + $_ }) -join ', '
Write-Host "06-schema-check PASSED: $summary on ${dbHost}:${dbPort}; tables, indexes, constraints, generated columns verified; idempotent" -ForegroundColor Green
exit 0


