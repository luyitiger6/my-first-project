# 契约闸门变异验证：仅修改临时副本，不修改真实子模块。
# 默认验证当前闸门；-CompareBaseline 同跑固定旧版本；-ReproduceOnly 只复现旧版。
[CmdletBinding()]
param(
    [switch]$CompareBaseline,
    [switch]$ReproduceOnly,
    [ValidateRange(1, 10)][int]$Repeat = 1,
    [string]$RepoRoot,
    [string]$BaselineRevision = '20a54f40ae6319565013d44a06fbfdc41ccab530'
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$utf8 = [Text.UTF8Encoding]::new($true)
if (-not $RepoRoot) {
    $RepoRoot = & git -C $PSScriptRoot rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0 -or -not $RepoRoot) { throw '无法定位工作区根目录，请传入 -RepoRoot' }
}
$gateRelative = 'harness/checks/10-contract-check.ps1'
$dto = 'backend/src/main/java/com/luyi/myfirst/web/auth/dto'
$errorDto = 'backend/src/main/java/com/luyi/myfirst/common/web/ErrorResponse.java'
$frontend = 'frontend/lib/contracts/auth.ts'
$currentGate = Join-Path $RepoRoot $gateRelative
$legacyText = $null
if ($CompareBaseline -or $ReproduceOnly) {
    $legacyText = (& git -C $RepoRoot show "${BaselineRevision}:$gateRelative") -join "`n"
    if ($LASTEXITCODE -ne 0 -or -not $legacyText) { throw '无法读取固定旧闸门版本' }
}

function Write-Fixture([string]$relative, [string]$text) {
    $path = Join-Path $script:fixture $relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
    [IO.File]::WriteAllText($path, $text, $utf8)
}
function Replace-Fixture([string]$relative, [string]$before, [string]$after) {
    $path = Join-Path $script:fixture $relative
    $text = [IO.File]::ReadAllText($path)
    if (-not $text.Contains($before)) { throw "样本注入锚点失效：$relative / $before" }
    Write-Fixture $relative ($text.Replace($before, $after))
}
function Replace-FrontendBlock([string]$name, [string]$before, [string]$after) {
    $text = [IO.File]::ReadAllText((Join-Path $script:fixture $frontend))
    $block = [regex]::Match($text, "(?s)export interface $name \{.*?\r?\n\}").Value
    if (-not $block -or -not $block.Contains($before)) { throw "接口样本锚点失效：$name / $before" }
    Replace-Fixture $frontend $block ($block.Replace($before, $after))
}
function Add-Shape([string]$name, [string]$javaFields, [string]$tsFields) {
    Write-Fixture "$dto/$name.java" "public record $name($javaFields) { }"
    $text = [IO.File]::ReadAllText((Join-Path $script:fixture $frontend))
    Write-Fixture $frontend ($text + "`nexport interface $name {`n$tsFields`n}`n")
}

# 每例记录旧版实际预期、修复后预期，以及必须出现的诊断，避免仅靠异常退出凑红灯。
$cases = @(
    @{ Id = '正常契约'; Old = 0; New = 0; Mutate = {}; Match = @('契约闸门\(10\) 通过') },
    @{ Id = 'H1-接口改名'; Old = 0; New = 1; Mutate = {
        Replace-Fixture $frontend 'interface RegisterResponse {' 'interface RenamedResponse {'
    }; Match = @('后端有、前端缺.*RegisterResponse', '前端有、后端缺.*RenamedResponse') },
    @{ Id = 'H1-删除接口'; Old = 0; New = 1; Mutate = {
        $text = [IO.File]::ReadAllText((Join-Path $script:fixture $frontend))
        $block = [regex]::Match($text, '(?s)export interface RegisterResponse \{.*?\r?\n\}').Value
        if (-not $block) { throw '删除接口样本锚点失效' }
        Replace-Fixture $frontend $block ''
    }; Match = @('后端有、前端缺.*RegisterResponse') },
    @{ Id = 'H2-跨接口类型覆盖'; Old = 0; New = 1; Mutate = {
        Replace-Fixture "$dto/LoginResponse.java" 'String email' 'int email'
    }; Match = @('LoginResponse.*email.*类型不一致') },
    @{ Id = 'H2-跨接口字段缺失'; Old = 0; New = 1; Mutate = {
        Replace-FrontendBlock 'RegisterResponse' '  email: string' ''
    }; Match = @('后端有、前端缺.*RegisterResponse.*email') },
    @{ Id = 'M1-字段大小写'; Old = 0; New = 1; Mutate = {
        Replace-Fixture $frontend 'publicId:' 'publicid:'
    }; Match = @('后端有、前端缺.*RegisterResponse.*publicId', '前端有、后端缺.*RegisterResponse.*publicid') },
    @{ Id = 'M1-后端字段大小写'; Old = 0; New = 1; Mutate = {
        Replace-Fixture "$dto/LoginResponse.java" 'Instant expiresAt' 'Instant expiresat'
    }; Match = @('后端有、前端缺.*LoginResponse.*expiresat', '前端有、后端缺.*LoginResponse.*expiresAt') },
    @{ Id = 'M1-接口大小写'; Old = 0; New = 1; Mutate = {
        Replace-Fixture $frontend 'interface RegisterResponse {' 'interface registerResponse {'
    }; Match = @('后端有、前端缺.*RegisterResponse', '前端有、后端缺.*registerResponse') },
    @{ Id = 'M1-字段并键'; Old = 0; New = 1; Mutate = {
        Add-Shape 'CaseFields' 'int userId, String userid' "  userId: string`n  userid: string"
    }; Match = @('CaseFields.*userId.*类型不一致') },
    @{ Id = 'M1-接口并键'; Old = 0; New = 1; Mutate = {
        Add-Shape 'CaseShape' 'int probe' '  probe: string'
        # 同文件避免 Windows 文件名大小写不敏感干扰接口名实验。
        Replace-Fixture "$dto/CaseShape.java" ' { }' " { }`nrecord caseshape(String probe) { }"
        $text = [IO.File]::ReadAllText((Join-Path $script:fixture $frontend))
        Write-Fixture $frontend ($text + "`nexport interface caseshape {`n  probe: string`n}`n")
    }; Match = @('CaseShape.*probe.*类型不一致') },
    @{ Id = 'M2-前端大写开头'; Old = 0; New = 1; Mutate = {
        Replace-FrontendBlock 'RegisterResponse' 'email:' 'Email:'
    }; Match = @('前端字段 RegisterResponse.Email 不是 camelCase') },
    @{ Id = 'M2-前端蛇形'; Old = 1; New = 1; Mutate = {
        Replace-FrontendBlock 'RegisterResponse' 'displayName:' 'display_name:'
    }; Match = @('前端字段 RegisterResponse.display_name 不是 camelCase') },
    @{ Id = 'M2-前端下划线开头'; Old = 1; New = 1; Mutate = {
        Replace-FrontendBlock 'RegisterResponse' 'email:' '_email:'
    }; Match = @('前端字段 RegisterResponse._email 不是 camelCase') },
    @{ Id = '保留-后端命名'; Old = 1; New = 1; Mutate = {
        Replace-Fixture "$dto/LoginResponse.java" 'String email' 'String e_mail'
    }; Match = @('后端字段 LoginResponse.e_mail 不是 camelCase') },
    @{ Id = '保留-时间映射'; Old = 1; New = 1; Mutate = {
        Replace-FrontendBlock 'LoginResponse' 'expiresAt: string' 'expiresAt: number'
    }; Match = @('LoginResponse.*expiresAt.*类型不一致') },
    @{ Id = '保留-未知Java类型'; Old = 1; New = 1; Mutate = {
        Replace-Fixture "$dto/LoginResponse.java" 'Instant expiresAt' 'Unknown expiresAt'
    }; Match = @('LoginResponse.*expiresAt.*fail-closed') },
    @{ Id = '保留-未知TS类型'; Old = 1; New = 1; Mutate = {
        Replace-FrontendBlock 'LoginResponse' 'expiresAt: string' 'expiresAt: Unknown'
    }; Match = @('LoginResponse.*expiresAt.*fail-closed') },
    @{ Id = '保留-JsonProperty'; Old = 1; New = 1; Mutate = {
        Replace-Fixture "$dto/LoginResponse.java" 'String email' '@JsonProperty("email") String email'
    }; Match = @('LoginResponse.java.*@JsonProperty') },
    @{ Id = '保留-前端空集合'; Old = 1; New = 1; Mutate = {
        Write-Fixture $frontend '// 无接口的负向样本'
    }; Match = @('前端未解析出任何 interface 字段') },
    @{ Id = '保留-后端空集合'; Old = 1; New = 1; Mutate = {
        foreach ($file in (Get-ChildItem (Join-Path $script:fixture $dto) -Filter *.java)) {
            [IO.File]::WriteAllText($file.FullName, '// 无 record 的负向样本', $utf8)
        }
        Write-Fixture $errorDto '// 无 record 的负向样本'
    }; Match = @('后端未解析出任何 record 字段') },
    @{ Id = '保留-空清单'; Old = 1; New = 1; GateMutation = $true; Mutate = {}; Match = @('受管契约清单为空') },
    @{ Id = '正常-不同接口同名不同类型'; Old = 0; New = 0; Mutate = {
        Add-Shape 'ShapeA' 'int probe' '  probe: number'
        Add-Shape 'ShapeB' 'String probe' '  probe: string'
    }; Match = @('契约闸门\(10\) 通过') },
    @{ Id = '正常-映射与别名'; Old = 0; New = 0; Mutate = {
        Add-Shape 'MappingShape' 'List<String> tags, int[] counts, boolean enabled, UUID id, Instant timestamp' "  tags: string[]`n  counts: Array<number>`n  enabled: boolean`n  id: Identifier`n  timestamp: string | null"
        $text = [IO.File]::ReadAllText((Join-Path $script:fixture $frontend))
        Write-Fixture $frontend ($text + "`ntype Identifier = string`n")
    }; Match = @('契约闸门\(10\) 通过') }
)
foreach ($field in @('token', 'accessToken', 'refreshToken', 'sessionId', 'Token')) {
    $cases += @{ Id = "保留-令牌-$field"; Old = 1; New = 1; Field = $field; Mutate = {
        Add-Shape 'TokenShape' "String $($case.Field)" "  $($case.Field): string"
    }; Match = @('后端字段 TokenShape\..*令牌字段禁现', '前端字段 TokenShape\..*令牌字段禁现') }
}

$tempRoot = Join-Path $env:TEMP ("contract-gate-" + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($tempRoot) | Out-Null
$failed = 0
$total = 0
try {
    for ($iteration = 1; $iteration -le $Repeat; $iteration++) {
        foreach ($case in $cases) {
            $script:fixture = Join-Path $tempRoot ([guid]::NewGuid().ToString('N'))
            $targetDto = Join-Path $script:fixture $dto
            [IO.Directory]::CreateDirectory($targetDto) | Out-Null
            Copy-Item (Join-Path $RepoRoot "$dto/*.java") $targetDto
            Write-Fixture $errorDto ([IO.File]::ReadAllText((Join-Path $RepoRoot $errorDto)))
            Write-Fixture $frontend ([IO.File]::ReadAllText((Join-Path $RepoRoot $frontend)))
            & $case.Mutate
            $versions = @('current')
            if ($ReproduceOnly) { $versions = @('legacy') }
            elseif ($CompareBaseline) { $versions = @('legacy', 'current') }
            foreach ($version in $versions) {
                $gate = $currentGate
                $arguments = @('-ContractRoot', $script:fixture)
                if ($version -eq 'legacy' -or $case.GateMutation) {
                    $text = if ($version -eq 'legacy') { $legacyText } else { [IO.File]::ReadAllText($currentGate) }
                    if ($case.GateMutation) {
                        $pattern = '(?ms)^\$contractPairs = @\(.*?^\)'
                        if (-not [regex]::IsMatch($text, $pattern)) { throw '空清单样本锚点失效' }
                        $text = [regex]::Replace($text, $pattern, '$contractPairs = @()')
                    }
                    Write-Fixture $gateRelative $text
                    $gate = Join-Path $script:fixture $gateRelative
                    $arguments = @()
                }
                $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $gate @arguments 2>&1)
                $code = $LASTEXITCODE
                $expected = if ($version -eq 'legacy') { $case.Old } else { $case.New }
                $diagnosticsOk = $true
                if ($version -eq 'current') {
                    foreach ($pattern in $case.Match) {
                        if (($output -join "`n") -cnotmatch $pattern) { $diagnosticsOk = $false }
                    }
                }
                $ok = $code -eq $expected -and $diagnosticsOk
                if (-not $ok) { $failed++ }
                $total++
                Write-Host "[$iteration][$version][$($case.Id)] EXIT=$code EXPECT=$expected DIAGNOSTICS=$diagnosticsOk"
                $output | ForEach-Object { Write-Host "  $_" }
            }
        }
    }
}
finally {
    # 仅清理由本次运行生成的 GUID 副本，真实受管文件始终只读。
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
Write-Host "验证汇总：$total 次检查，$failed 次断言失败；临时副本已清理。"
if ($failed -gt 0) { exit 1 }
exit 0
