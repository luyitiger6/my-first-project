# backfill-post-interaction-counts.ps1
#
# 一次性回填：按互动表重算 posts 的三列互动计数，并校验不存在偏差。
# 只在 sync-interaction-counts 上线前对既有库执行一次；schema.sql 不承载回填
# （建表脚本只负责结构，数据修复留在可审计的手动脚本里）。
# 可重复执行：同一份互动数据算出的计数相同，updated_at 被显式保持不变。
#
# 凭据与 06 建表闸门一致：SCHEMA_DB_PASSWORD，未设置时从发布 8806 的容器里读。
# 通过 exit 0，失败 exit 1，不交互提问。

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$dbHost = if ($env:SCHEMA_DB_HOST) { $env:SCHEMA_DB_HOST } else { '127.0.0.1' }
$dbPort = if ($env:SCHEMA_DB_PORT) { [int]$env:SCHEMA_DB_PORT } else { 8806 }
$dbUser = if ($env:SCHEMA_DB_USER) { $env:SCHEMA_DB_USER } else { 'root' }
$dbName = 'wanderchain'
$dbPassword = $env:SCHEMA_DB_PASSWORD

function Fail([string]$Message) {
  Write-Host "backfill FAILED: $Message" -ForegroundColor Red
  exit 1
}

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
  param([Parameter(Mandatory = $true)][string]$Sql)

  if ($container) {
    $output = & docker exec -e "MYSQL_PWD=$dbPassword" $container mysql -u $dbUser -N -B --default-character-set=utf8mb4 $dbName -e $Sql 2>&1
    $code = $LASTEXITCODE
  } else {
    if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
      Fail 'Neither a Docker container publishing the port nor a local mysql client is available'
    }
    $oldPwd = $env:MYSQL_PWD
    $env:MYSQL_PWD = $dbPassword
    try {
      $output = & mysql -h $dbHost -P ([string]$dbPort) -u $dbUser -N -B --default-character-set=utf8mb4 $dbName -e $Sql 2>&1
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

# 回填：三列各自按互动表重算。updated_at = updated_at 抑制 ON UPDATE CURRENT_TIMESTAMP(3)，
# 否则一次回填会把全库帖子顶到 feed 顶部。
$backfill = @'
update posts p
set p.up_vote_count = (select count(*) from post_votes v
                       where v.post_id = p.id and v.direction = 'up' and v.deleted_at is null),
    p.comment_count = (select count(*) from post_comments c
                       where c.post_id = p.id and c.deleted_at is null),
    p.bookmark_count = (select count(*) from post_bookmarks b
                        where b.post_id = p.id and b.deleted_at is null),
    p.updated_at = p.updated_at
'@

# 校验：任一列与互动表不一致的帖子数，必须为 0。
$verify = @'
select count(*) from posts p
where p.up_vote_count <> (select count(*) from post_votes v
                          where v.post_id = p.id and v.direction = 'up' and v.deleted_at is null)
   or p.comment_count <> (select count(*) from post_comments c
                          where c.post_id = p.id and c.deleted_at is null)
   or p.bookmark_count <> (select count(*) from post_bookmarks b
                           where b.post_id = p.id and b.deleted_at is null)
'@

$before = @(Invoke-Sql -sql $verify)[0]
Write-Host "posts disagreeing before backfill: $before"

Invoke-Sql -sql $backfill | Out-Null

$after = @(Invoke-Sql -sql $verify)[0]
if ($after -ne '0') {
  Fail "still $after post(s) disagree with the interaction tables after backfill"
}

Write-Host "backfill PASSED: $before post(s) corrected; all posts agree with the interaction tables" -ForegroundColor Green
exit 0
