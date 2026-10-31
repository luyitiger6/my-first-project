param(
    [switch]$PreflightOnly,
    [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$stage = 'preflight'
$localDb = 'jdbc:mysql://127.0.0.1:8806/wanderchain?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=utf8&allowPublicKeyRetrieval=true&useSSL=false'

function Read-LocalEnvironment([string]$Name) {
    foreach ($scope in @('Process', 'User', 'Machine')) {
        $value = [Environment]::GetEnvironmentVariable($Name, $scope)
        if ($value) { return $value }
    }
    return $null
}

function New-Secret([int]$Length) {
    $bytes = New-Object byte[] $Length
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

function Invoke-Initializer([string[]]$Arguments) {
    # 原始输出只留在进程内，仅回显初始化器不含秘密的固定结果行。
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& java -classpath $classPath SeedPostsAccounts @Arguments 2>&1)
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedPreference
    }
    foreach ($line in $output) {
        if ($line.ToString() -match 'SeedPostsAccounts: (.+)$') {
            Write-Host "SeedPostsAccounts: $($Matches[1])"
        }
    }
    return $code
}

function Confirm-Accounts {
    $publicIds = @()
    foreach ($alias in @('A', 'B')) {
        $email = $inputs["E2E_POSTS_ACCOUNT_${alias}_EMAIL"]
        $password = $inputs["E2E_POSTS_ACCOUNT_${alias}_PASSWORD"]
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $body = @{ email = $email; password = $password } | ConvertTo-Json -Compress
        $login = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Method Post -WebSession $session -Uri 'http://localhost:3000/api/auth/login' -Headers @{ Origin = 'http://localhost:3000' } -ContentType 'application/json' -Body $body
        $me = Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -WebSession $session -Uri 'http://localhost:3000/api/auth/me'
        $account = $me.Content | ConvertFrom-Json
        $loginAccount = $login.Content | ConvertFrom-Json
        if ($login.StatusCode -ne 200 -or $me.StatusCode -ne 200 -or $account.status -ne 'active' -or $account.email -ne $email -or $account.publicId -ne $loginAccount.publicId) {
            throw 'ACCOUNT_CONFIRMATION_FAILED'
        }
        $publicIds += $account.publicId
        Write-Host "AccountsCheck: account=$alias login=200 me=200 status=active"
    }
    if ($publicIds.Count -ne 2 -or $publicIds[0] -eq $publicIds[1]) { throw 'ACCOUNT_ISOLATION_FAILED' }
    Write-Host 'AccountsCheck: distinctAccounts=2 proxy=localhost:3000'
}

try {
    if ($PreflightOnly -and $ValidateOnly) { throw 'ARGUMENTS_REJECTED' }
    # 生产及非本地覆盖在生成资料、启动容器或写账户前拒绝。
    foreach ($name in @('SPRING_PROFILES_ACTIVE', 'SPRING_PROFILES_DEFAULT')) {
        $value = Read-LocalEnvironment $name
        if ($value -and ($value -split '[,;\s]+' | Where-Object { $_ -ieq 'prod' })) { throw 'PROD_REJECTED' }
    }
    $overrides = @{
        SPRING_DATASOURCE_URL = $localDb
        SPRING_DATA_REDIS_HOST = '127.0.0.1'
        SPRING_DATA_REDIS_PORT = '6606'
        SPRING_DATA_REDIS_DATABASE = '3'
    }
    foreach ($name in $overrides.Keys) {
        $value = Read-LocalEnvironment $name
        if ($value -and $value -cne $overrides[$name]) { throw 'LOCAL_STORAGE_REJECTED' }
    }

    $names = @('E2E_POSTS_ACCOUNT_A_EMAIL', 'E2E_POSTS_ACCOUNT_A_PASSWORD', 'E2E_POSTS_ACCOUNT_B_EMAIL', 'E2E_POSTS_ACCOUNT_B_PASSWORD')
    $inputs = @{}
    foreach ($name in $names) { $inputs[$name] = Read-LocalEnvironment $name }
    $present = @($names | Where-Object { $inputs[$_] }).Count
    if ($present -ne 0 -and $present -ne 4) { throw 'ACCOUNT_ENVIRONMENT_PARTIAL' }
    if ($ValidateOnly -and $present -ne 4) { throw 'ACCOUNT_ENVIRONMENT_MISSING' }
    if ($present -eq 4 -and -not $PreflightOnly) {
        $stage = 'login-existing'
        Write-Host 'AccountsCheck: existingCredentials=YES initialization=NO'
        Confirm-Accounts
        exit 0
    }

    $stage = 'compile'
    $classpathFile = Join-Path $backendRoot 'target/posts-seed.classpath'
    & mvn -f (Join-Path $backendRoot 'pom.xml') compile dependency:build-classpath '-Dmdep.includeScope=runtime' "-Dmdep.outputFile=$classpathFile"
    if ($LASTEXITCODE -ne 0) { throw 'DEPENDENCY_BUILD_FAILED' }
    $classes = Join-Path $backendRoot 'target/posts-seed'
    New-Item -ItemType Directory -Force -Path $classes | Out-Null
    $dependencies = (Get-Content -Raw -LiteralPath $classpathFile).Trim()
    $classPath = "${classes};$(Join-Path $backendRoot 'target/classes');$dependencies"
    & javac -encoding UTF-8 -classpath $classPath -d $classes (Join-Path $backendRoot 'tools/SeedPostsAccounts.java')
    if ($LASTEXITCODE -ne 0) { throw 'INITIALIZER_COMPILE_FAILED' }

    $stage = 'runtime-environment'
    # 复用既有本机容器，不新建容器，不执行重建数据库闸门。
    # 先完整接收原生命令输出，避免 First 提前结束管道导致退出码被误判为 -1。
    $mysqlNames = @(docker ps --filter publish=8806 --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0 -or $mysqlNames.Count -ne 1) { throw 'MYSQL_UNAVAILABLE' }
    $mysqlName = $mysqlNames[0]
    $redisNames = @(docker ps --filter publish=6606 --format '{{.Names}}')
    if ($LASTEXITCODE -ne 0 -or $redisNames.Count -ne 1) { throw 'REDIS_UNAVAILABLE' }
    $redisName = $redisNames[0]
    $mysql = (docker inspect $mysqlName | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0) { throw 'MYSQL_CONFIGURATION_UNAVAILABLE' }
    $redis = (docker inspect $redisName | ConvertFrom-Json)[0]
    if ($LASTEXITCODE -ne 0) { throw 'REDIS_CONFIGURATION_UNAVAILABLE' }
    $rootPassword = $mysql.Config.Env | Where-Object { $_ -like 'MYSQL_ROOT_PASSWORD=*' } | Select-Object -First 1
    $redisArgs = @($redis.Config.Cmd)
    $passIndex = [Array]::IndexOf($redisArgs, '--requirepass')
    if (-not $rootPassword -or $passIndex -lt 0 -or $passIndex + 1 -ge $redisArgs.Count) { throw 'RUNTIME_CREDENTIALS_MISSING' }
    $env:WANDERCHAIN_DB_USER = 'root'
    $env:WANDERCHAIN_DB_PASSWORD = $rootPassword.Substring('MYSQL_ROOT_PASSWORD='.Length)
    $env:WANDERCHAIN_REDIS_PASSWORD = $redisArgs[$passIndex + 1]
    # 临时上下文密钥不影响已经运行的 8989 进程；联通时仍由它正常登录签发。
    $env:WANDERCHAIN_JWT_SECRET = New-Secret 64

    if ($present -eq 0) {
        $runId = [Guid]::NewGuid().ToString('N')
        foreach ($alias in @('A', 'B')) {
            $inputs["E2E_POSTS_ACCOUNT_${alias}_EMAIL"] = "wc-posts-$($alias.ToLowerInvariant())-$runId@example.test"
            $inputs["E2E_POSTS_ACCOUNT_${alias}_PASSWORD"] = New-Secret 32
        }
    }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $inputs[$name], 'Process') }
    $stage = 'initializer-preflight'
    if ((Invoke-Initializer -Arguments @('--check-only')) -ne 0) { throw 'INITIALIZER_PREFLIGHT_FAILED' }
    if ($PreflightOnly) {
        Write-Host 'AccountsCheck: preflight=OK accountWrites=0 credentialsPersisted=NO'
        exit 0
    }

    $stage = 'persist-environment'
    # 写前保留随机凭据，部分成功或进程中断时仍可找回；不写任何秘密文件。
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $inputs[$name], 'User') }
    $stage = 'initialize'
    if ((Invoke-Initializer -Arguments @()) -ne 0) { throw 'INITIALIZATION_FAILED_NO_RETRY' }
    $stage = 'login-new'
    Confirm-Accounts
    Write-Host 'AccountsCheck: initialization=OK credentials=USER_ENVIRONMENT'
    exit 0
} catch {
    # 只输出阶段及受控错误标识，不回显请求体、容器输出或异常正文。
    $reason = if ($_.Exception.Message -cmatch '^[A-Z_]+$') { $_.Exception.Message } else { $_.Exception.GetType().Name }
    Write-Host "AccountsCheck: FAILED stage=$stage reason=$reason retry=NO"
    exit 1
}
