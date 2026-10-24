# 05-scaffold-check.ps1
# 改名闸门：在临时目录演练 scaffold/rename.mjs 并做旧名残留扫描。
# 通过则 exit 0，不通过则 exit 1；不做任何交互式提问（AGENTS.md §8 约定）。
# 演练而非扫描本仓库：模板仓库自身（未改名）与改名后的使用者仓库都能过闸门。

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# ---- 复制仓库到临时目录（排除 .git 与构建产物；openspec/ 随副本复制，扫描阶段排除）----
function Copy-Tree {
    param($src, $dst, $excludeDirs)
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Get-ChildItem -Path $src -Force | Where-Object {
        if ($_.PSIsContainer) { return ($excludeDirs -notcontains $_.Name) }
        return $true
    } | ForEach-Object {
        if ($_.PSIsContainer) { Copy-Tree $_.FullName (Join-Path $dst $_.Name) $excludeDirs }
        else { Copy-Item $_.FullName -Destination (Join-Path $dst $_.Name) -Force }
    }
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('scaffold-check-' + [System.Guid]::NewGuid().ToString('N'))
try {
    Write-Host 'Running: 05-scaffold-check (模板改名演练)' -ForegroundColor DarkGray
    Copy-Tree $projectRoot $tempRoot @('.git', 'target', 'node_modules', 'dist')

    # ---- 在副本中执行改名脚本 ----
    $renameScript = Join-Path $tempRoot 'scaffold\rename.mjs'
    if (-not (Test-Path $renameScript)) {
        Write-Host '05-scaffold-check FAILED: 副本中缺少 scaffold/rename.mjs' -ForegroundColor Red
        exit 1
    }
    & node.exe $renameScript --name demo-app --package com.demo.app
    if ($LASTEXITCODE -ne 0) {
        Write-Host '05-scaffold-check FAILED: 改名脚本执行失败（退出码非 0）' -ForegroundColor Red
        exit 1
    }

    # ---- 副本内残留扫描（排除 .git、构建产物、openspec/ 流程工件层与改名工具自身）----
    $hits = Get-ChildItem -Path $tempRoot -Recurse -File | Where-Object {
        $rel = $_.FullName.Substring($tempRoot.Length).TrimStart('\', '/')
        return -not (
            $rel.StartsWith('.git\') -or $rel.StartsWith('target\') -or
            $rel.StartsWith('node_modules\') -or $rel.StartsWith('dist\') -or
            $rel.StartsWith('openspec\') -or $rel.StartsWith('scaffold\') -or
            $rel -eq 'harness\checks\05-scaffold-check.ps1'
        )
    } | Select-String -Pattern 'my-first-project|com\.luyi|com/luyi|myfirst' -List
    if ($hits) {
        Write-Host '05-scaffold-check FAILED: 改名演练后仍存在旧名残留:' -ForegroundColor Red
        foreach ($h in $hits) { Write-Host ('  ' + $h.Path) -ForegroundColor Red }
        exit 1
    }

    Write-Host '05-scaffold-check PASSED: 改名演练与残留扫描通过' -ForegroundColor Green
    exit 0
}
finally {
    if (Test-Path $tempRoot) { Remove-Item -Path $tempRoot -Recurse -Force }
}
