# 05-scaffold-check.ps1
# 改名闸门：在临时目录演练 scaffold/rename.mjs 并做旧身份残留扫描。
# 通过则 exit 0，不通过则 exit 1；不做任何交互式提问（AGENTS.md §8 约定）。
#
# 演练而非改写本仓库：无论当前仓库处于模板态还是已改名态，闸门都只操作临时副本。
# 旧身份 token 由字符串拼接构造，闸门自身不会成为残留扫描的命中源。

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$oldDisplay = 'AI' + 'WorkSpace'
$oldSlug = 'ai' + '-workspace'

# 复制排除：不属于工作区身份改名范围，或体积/性质不适合复制
$copyExcludedDirs = @(
    '.git', 'backend', 'frontend', 'openspec', 'docs',
    '.idea', '.vscode', '.scaffold-tmp',
    'target', 'node_modules', 'dist'
)

# 扫描额外排除：改名工具自身（按契约必然包含旧 token），与 URL 含 token 但不在改名范围内的文件
$scanExcludedDirs = $copyExcludedDirs + @('scaffold')
$excludedFiles = @('.gitmodules', 'harness\checks\05-scaffold-check.ps1')

function Copy-Tree {
    param($src, $dst)
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Get-ChildItem -Path $src -Force | Where-Object {
        if ($_.PSIsContainer) { return ($copyExcludedDirs -notcontains $_.Name) }
        return $true
    } | ForEach-Object {
        if ($_.PSIsContainer) { Copy-Tree $_.FullName (Join-Path $dst $_.Name) }
        else { Copy-Item $_.FullName -Destination (Join-Path $dst $_.Name) -Force }
    }
}

function Fail {
    param([string]$Message)
    Write-Host "05-scaffold-check FAILED: $Message" -ForegroundColor Red
    exit 1
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('scaffold-check-' + [System.Guid]::NewGuid().ToString('N'))
try {
    Write-Host 'Running: 05-scaffold-check (工作区改名演练)' -ForegroundColor DarkGray
    Copy-Tree $projectRoot $tempRoot

    $renameScript = Join-Path $tempRoot 'scaffold\rename.mjs'
    if (-not (Test-Path -LiteralPath $renameScript)) {
        Fail '副本中缺少 scaffold/rename.mjs'
    }

    $gitmodules = Join-Path $tempRoot '.gitmodules'
    if (-not (Test-Path -LiteralPath $gitmodules)) {
        Fail '副本中缺少 .gitmodules（工作区应以子模块挂载前后端）'
    }

    # 演练种子：让副本无论是否已改名都具备旧工作区身份，保证改名演练可重复
    $seed = "`nworkspace-identity-drill: $oldDisplay / $oldSlug`n"
    foreach ($doc in @('AGENTS.md', 'README.md')) {
        $docPath = Join-Path $tempRoot $doc
        if (-not (Test-Path -LiteralPath $docPath)) {
            Fail "副本中缺少 $doc"
        }
        [IO.File]::AppendAllText($docPath, $seed, (New-Object Text.UTF8Encoding($false)))
    }

    $hashBefore = (Get-FileHash -LiteralPath $gitmodules -Algorithm SHA256).Hash

    # ---- 在副本中执行工作区改名演练 ----
    & node.exe $renameScript --name scaffold-demo --display 'Scaffold Demo'
    if ($LASTEXITCODE -ne 0) {
        Fail '改名脚本执行失败（退出码非 0）'
    }

    $hashAfter = (Get-FileHash -LiteralPath $gitmodules -Algorithm SHA256).Hash
    if ($hashAfter -ne $hashBefore) {
        Fail '.gitmodules 在改名演练中被修改（子模块 URL 不属于工作区改名范围）'
    }

    # ---- 副本内残留扫描 ----
    $pattern = ([regex]::Escape($oldDisplay)) + '|' + ([regex]::Escape($oldSlug))
    $hits = Get-ChildItem -Path $tempRoot -Recurse -File -Force | Where-Object {
        $rel = $_.FullName.Substring($tempRoot.Length).TrimStart('\', '/')
        foreach ($prefix in $scanExcludedDirs) {
            if ($rel.StartsWith($prefix + '\', [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
        }
        foreach ($file in $excludedFiles) {
            if ($rel.Equals($file, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
        }
        return $true
    } | Select-String -Pattern $pattern -List

    if ($hits) {
        Write-Host '05-scaffold-check FAILED: 改名演练后仍存在旧工作区身份残留:' -ForegroundColor Red
        foreach ($h in $hits) {
            Write-Host ('  ' + $h.Path.Substring($tempRoot.Length).TrimStart('\', '/')) -ForegroundColor Red
        }
        exit 1
    }

    Write-Host '05-scaffold-check PASSED: 改名演练、.gitmodules 完整性与残留扫描通过' -ForegroundColor Green
    exit 0
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
