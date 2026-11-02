# 一次性演示数据：给景点与景点评论各灌入千条量级数据，用来在真实数据量下观察景区读缓存。
#
# 这些数据只服务于本地观察，不进 schema.sql（那是版本控制的真相，12 条种子被既有断言依赖）。
#
# 形状约束（改动前先读 DESIGN D11/D12 与 schema.sql）：
# - attractions.city_slug 受 ck_attractions_city_slug 锁死，只能是七个 slug，因此回滚
#   不能靠「城市标记」，只能靠 public_id 前缀；
# - curated_rank_* 全部留 NULL，三个策展榜单的成员与顺序完全不受影响；
# - 浏览数取低位、published_at 取早期时间，hot / new 榜首仍是原种子；
# - 名称与正文一律 ASCII，避免不同终端的编码差异把中文插成乱码。
#
# 用法：
#   powershell -File scripts\seed-demo-data.ps1            # 造数（默认各 1000 条，可重复执行）
#   powershell -File scripts\seed-demo-data.ps1 -Cleanup   # 按前缀精确删除，其余行一律不动

param(
  [int]$Attractions = 1000,
  [int]$Comments = 1000,
  [switch]$Cleanup,
  [string]$Container,
  [string]$DbHost = '127.0.0.1',
  [int]$DbPort = 8806,
  [string]$DbUser = 'root',
  [string]$Database = 'wanderchain'
)

$ErrorActionPreference = 'Stop'

$BulkPrefix = '01BULK'
$CommentPrefix = '01COMM'
$DemoAccountId = '01BULKDEMOACCOUNT000000000'
$DemoAccountEmail = 'bulk-demo@wanderchain.invalid'

$cities = @('beijing', 'shanghai', 'guangzhou', 'chengdu', 'xian', 'hangzhou', 'sanya')

if (-not $Container) {
  $Container = (docker ps --filter "publish=$DbPort" --format "{{.Names}}" | Select-Object -First 1)
}
if (-not $Container) {
  throw "没有容器发布 $DbPort 端口；请用 -Container 指定，或先启动 MySQL 容器"
}

function Invoke-Sql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  # 用 MYSQL_PWD 传密码：-p 写法会往 stderr 打印警告，而 $ErrorActionPreference='Stop'
  # 会把那行警告当成终止性错误，脚本直接死在第一条 SQL 上。
  $shell = 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u' + $DbUser + ' -N -B --default-character-set=utf8mb4 ' + $Database
  $output = $Sql | & docker exec -i $Container sh -c $shell 2>&1
  $code = $LASTEXITCODE
  $lines = @($output | ForEach-Object { [string]$_ } | Where-Object { $_ -notmatch '^mysql: \[Warning\]' })
  if ($code -ne 0) {
    throw "SQL 执行失败（退出码 $code）：`n$($lines -join "`n")"
  }
  return $lines
}

function Format-Id([string]$prefix, [int]$number) {
  return $prefix + $number.ToString('D20')
}

function Count-Rows([string]$table, [string]$where) {
  $sql = "SELECT COUNT(*) FROM $table WHERE $where;"
  return [int](Invoke-Sql -Sql $sql | Select-Object -First 1)
}

if ($Cleanup) {
  $before = @{
    attractions        = Count-Rows 'attractions' '1 = 1'
    comments           = Count-Rows 'attraction_comments' '1 = 1'
  }
  Invoke-Sql -Sql "DELETE FROM attraction_comments WHERE public_id LIKE '$CommentPrefix%';" | Out-Null
  Invoke-Sql -Sql "DELETE FROM attractions WHERE public_id LIKE '$BulkPrefix%';" | Out-Null
  # 演示账号只为满足评论外键而存在；评论已删空才动它，且只认这一个邮箱
  Invoke-Sql -Sql "DELETE FROM accounts WHERE public_id = '$DemoAccountId' AND email = '$DemoAccountEmail';" | Out-Null

  $after = @{
    attractions        = Count-Rows 'attractions' '1 = 1'
    comments           = Count-Rows 'attraction_comments' '1 = 1'
  }
  Write-Host ("cleanup done: attractions {0} -> {1}, attraction_comments {2} -> {3}" -f `
    $before.attractions, $after.attractions, $before.comments, $after.comments) -ForegroundColor Green
  exit 0
}

# 1. 景点：1000 条，curated_rank_* 留 NULL（不传这两列即默认 NULL）
$batchSize = 100
for ($offset = 0; $offset -lt $Attractions; $offset += $batchSize) {
  $values = New-Object System.Collections.Generic.List[string]
  $end = [Math]::Min($offset + $batchSize, $Attractions)
  for ($i = $offset; $i -lt $end; $i++) {
    $n = $i + 1
    $city = $cities[$i % $cities.Count]
    $rating = if ($n % 5 -eq 0) { 'NULL' } else { ('{0:0.0}' -f (2 + ($n % 30) / 10)) }
    $viewCount = 1 + ($n % 50)
    $publishedAt = '2026-01-01 00:00:00.000'
    $values.Add(("('{0}','{1}','Demo Spot {2}','Demo Spot {2}','https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=70','published','{3}',{4},{5},0,0,1,'Bulk demo row {2} for cache observation.','Bulk demo body {2}. Only used to inflate row count locally.',NULL,'2026-01-01 00:00:00.000')" -f `
      (Format-Id $BulkPrefix $n), $city, $n, $publishedAt, $rating, $viewCount))
  }
  $sql = "INSERT IGNORE INTO attractions (public_id, city_slug, name_en, name_cn, cover_url, status, published_at, rating, view_count, free_entry, booking_required, open_on_monday, summary_en, content_en, ticket_info_en, verified_at) VALUES " + ($values -join ',') + ';'
  Invoke-Sql -Sql $sql | Out-Null
}
Write-Host "inserted attractions up to $Attractions rows" -ForegroundColor DarkGray

# 2. 评论需要一个账号满足外键：优先用库里已有账号，一条都没有时只造一个不可登录的演示账号
$accountLines = @(Invoke-Sql -Sql "SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY id;")
if ($accountLines.Count -eq 0) {
  $insertAccount = "INSERT IGNORE INTO accounts (public_id, email, password_hash, display_name, status) VALUES ('$DemoAccountId','$DemoAccountEmail','bulk-demo-not-a-login-account','Bulk Demo','active');"
  Invoke-Sql -Sql $insertAccount | Out-Null
  Write-Host "no account found, created demo account $DemoAccountEmail (cannot log in)" -ForegroundColor Yellow
  $accountLines = @(Invoke-Sql -Sql "SELECT id FROM accounts WHERE deleted_at IS NULL ORDER BY id;")
}
$accountIds = @($accountLines | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
if ($accountIds.Count -eq 0) {
  throw '没有可用账号，无法为景点评论提供 account_id'
}

# 3. 景点评论：1000 条，均匀挂到库里可见的景点上
$attractionLines = @(Invoke-Sql -Sql "SELECT id FROM attractions WHERE deleted_at IS NULL AND status = 'published' ORDER BY id;")
$attractionIds = @($attractionLines | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
if ($attractionIds.Count -eq 0) {
  throw '库里没有已发布景点，无法为景点评论提供 attraction_id'
}

for ($offset = 0; $offset -lt $Comments; $offset += $batchSize) {
  $values = New-Object System.Collections.Generic.List[string]
  $end = [Math]::Min($offset + $batchSize, $Comments)
  for ($i = $offset; $i -lt $end; $i++) {
    $n = $i + 1
    $attractionId = $attractionIds[$i % $attractionIds.Count]
    $accountId = $accountIds[$i % $accountIds.Count]
    $values.Add(("('{0}',{1},{2},'Bulk demo comment {3}. Used only to inflate row count locally.','2026-02-01 00:00:00.000')" -f `
      (Format-Id $CommentPrefix $n), $attractionId, $accountId, $n))
  }
  $sql = "INSERT IGNORE INTO attraction_comments (public_id, attraction_id, account_id, content, created_at) VALUES " + ($values -join ',') + ';'
  Invoke-Sql -Sql $sql | Out-Null
}
Write-Host "inserted attraction_comments up to $Comments rows" -ForegroundColor DarkGray

$bulkAttractions = Count-Rows 'attractions' "public_id LIKE '$BulkPrefix%'"
$bulkComments = Count-Rows 'attraction_comments' "public_id LIKE '$CommentPrefix%'"
$allAttractions = Count-Rows 'attractions' '1 = 1'
$allComments = Count-Rows 'attraction_comments' '1 = 1'
Write-Host ("seed done: attractions total {0} (bulk {1}), attraction_comments total {2} (bulk {3})" -f `
  $allAttractions, $bulkAttractions, $allComments, $bulkComments) -ForegroundColor Green
