<#
    闸门 11-conventions-check：开发约定文档自洽性与后端分层依赖方向
    拦截四类「约定形同虚设」：

      1. 约定文档没有唯一入口，或索引与目录对不上
         新增一份文档忘记登记，agent 读不到它就等于它不存在。
      2. 约定文档描述的依赖与两侧依赖清单不一致
         照着一份写着 Tailwind 的文档写代码，而 package.json 里根本没有它。
      3. 约定文档声称被某道闸门守住，而那道闸门并不存在
         比不写更糟：读者以为有保护，实际没有。
      4. 后端分层依赖倒挂（dao/service 引用 web，common 引用业务层）
         分层只在文档里成立、在代码里不成立时，重构会一路向上感染。

    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$problems = New-Object System.Collections.ArrayList
function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

$docsDir   = Join-Path $projectRoot 'docs\conventions'
$indexPath = Join-Path $docsDir 'README.md'
$agentsDoc = Join-Path $projectRoot 'AGENTS.md'
$checksDir = Join-Path $projectRoot 'harness\checks'
$indexRef  = 'docs/conventions/README.md'

function Get-SectionText {
    param([string]$Text, [string]$Title)
    if (-not $Text) { return $null }
    $pattern = '(?ms)^##\s+' + [regex]::Escape($Title) + '\s*$' + '(.*?)(?=^##\s|\z)'
    $m = [regex]::Match($Text, $pattern)
    if ($m.Success) { return $m.Groups[1].Value }
    return $null
}

function Get-BacktickTokens {
    param([string]$Text)
    if (-not $Text) { return @() }
    return @([regex]::Matches($Text, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value.Trim() })
}

# 索引里的短文件名相对 docs\conventions\ 自然，带目录的路径相对项目根自然。
# 两处都试，两处都没有才算登记了不存在的文件。
function Test-DocPath {
    param([string]$Token)
    $relative = $Token -replace '/', '\'
    foreach ($base in @($projectRoot, $docsDir)) {
        if (Test-Path -LiteralPath (Join-Path $base $relative)) { return $true }
    }
    return $false
}

# ---- 依赖清单：frontend/package.json 的两个依赖段 + backend/pom.xml 的 <dependency> 块 ----
$frontendDeps = @()
$pkgPath = Join-Path $projectRoot 'frontend\package.json'
if (Test-Path -LiteralPath $pkgPath) {
    $pkg = Get-Content -LiteralPath $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($bucket in @('dependencies', 'devDependencies')) {
        $node = $pkg.PSObject.Properties[$bucket]
        if ($node -and $node.Value) {
            $frontendDeps += @($node.Value.PSObject.Properties.Name)
        }
    }
}

$backendDeps = @()
$pomPath = Join-Path $projectRoot 'backend\pom.xml'
if (Test-Path -LiteralPath $pomPath) {
    $pom = Get-Content -LiteralPath $pomPath -Raw -Encoding UTF8
    $backendDeps = @([regex]::Matches($pom, '(?s)<dependency>\s*<groupId>[^<]*</groupId>\s*<artifactId>([^<]+)</artifactId>') |
        ForEach-Object { $_.Groups[1].Value.Trim() })
}
$allDeps = @($frontendDeps + $backendDeps)

# ---- 1. 索引存在，且与目录双向一致 ----
if (-not (Test-Path -LiteralPath $indexPath)) {
    Add-Problem "缺少统一入口：$indexRef"
}
else {
    $indexText = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8
    # 只校验「索引」小节：正文里的反引号是在举例（比如跨目录通配），不是登记项。
    $indexSection = Get-SectionText $indexText '索引'
    if (-not $indexSection) {
        Add-Problem "$indexRef 缺少「索引」小节"
    }
    else {
        foreach ($tok in (Get-BacktickTokens $indexSection)) {
            if ($tok -notmatch '\.md$') { continue }
            if ($tok -eq $indexRef) { continue }
            if (-not (Test-DocPath $tok)) {
                Add-Problem "索引登记了不存在的文件：$tok"
            }
        }
    }
}

# ---- 2~5. 每份约定文档的四个固定小节 ----
$files = @()
if (Test-Path -LiteralPath $docsDir) {
    $files = @(Get-ChildItem -LiteralPath $docsDir -Filter '*.md' -File)
}

if (Test-Path -LiteralPath $docsDir) {
    foreach ($f in $files) {
        if ($f.Name -ne 'README.md') {
            $indexSection = if (Test-Path -LiteralPath $indexPath) { Get-SectionText (Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8) '索引' } else { '' }
            if ($indexSection -notmatch [regex]::Escape($f.Name)) {
                Add-Problem "约定文档未登记进索引：$($f.Name)"
            }
        }

        $text = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8

        foreach ($section in @('真源声明', '依赖现状', '拟引入', '机械守卫')) {
            # 存在性必须用 $null -eq：小节存在但内容为空时返回空字符串，
            # 用 -not 判断会把它误报成「缺少小节」，与「为空」混为一谈。
            if ($null -eq (Get-SectionText $text $section)) {
                Add-Problem "$($f.Name) 缺少「$section」小节"
            }
        }

        $srcText = Get-SectionText $text '真源声明'
        foreach ($tok in (Get-BacktickTokens $srcText)) {
            if ($tok -notmatch '\.md$' -and $tok -notmatch '/$') { continue }
            if ($tok -match '[*?]') { continue }
            if (-not (Test-DocPath $tok)) {
                Add-Problem "$($f.Name) 真源声明引用了不存在的路径：$tok"
            }
        }

        $nowDeps  = Get-BacktickTokens (Get-SectionText $text '依赖现状')
        $planDeps = Get-BacktickTokens (Get-SectionText $text '拟引入')
        foreach ($d in $nowDeps) {
            if ($allDeps -notcontains $d) {
                Add-Problem "$($f.Name)「依赖现状」写了依赖清单中不存在的名字：$d"
            }
        }
        foreach ($d in $planDeps) {
            if ($allDeps -contains $d) {
                Add-Problem "$($f.Name)「拟引入」写了已存在的依赖：$d"
            }
            if ($nowDeps -contains $d) {
                Add-Problem "$($f.Name)「拟引入」与「依赖现状」重复：$d"
            }
        }

        $gateText = Get-SectionText $text '机械守卫'
        # 必须用 $null -ne 判断：空字符串在 PowerShell 里是 falsy，
        # 写成 if ($gateText -and ...) 会让「小节存在但完全无内容」这一情况永远漏检。
        if ($null -ne $gateText -and $gateText.Trim().Length -eq 0) {
            Add-Problem "$($f.Name)「机械守卫」小节为空"
        }
        foreach ($g in @([regex]::Matches($gateText, '\b(\d{2}-[a-z][a-z0-9-]*\.ps1)\b') | ForEach-Object { $_.Groups[1].Value })) {
            if (-not (Test-Path -LiteralPath (Join-Path $checksDir $g))) {
                Add-Problem "$($f.Name)「机械守卫」引用了不存在的闸门：$g"
            }
        }
    }
}

# ---- 6. AGENTS.md 引用入口，且目录树含每个闸门文件 ----
if (-not (Test-Path -LiteralPath $agentsDoc)) {
    Add-Problem 'AGENTS.md 不存在'
}
else {
    $agentsText = Get-Content -LiteralPath $agentsDoc -Raw -Encoding UTF8
    if ($agentsText -notmatch [regex]::Escape($indexRef)) {
        Add-Problem "AGENTS.md 未引用约定入口：$indexRef"
    }
    foreach ($gate in @(Get-ChildItem -LiteralPath $checksDir -Filter '*.ps1' -File | ForEach-Object { $_.Name })) {
        if ($agentsText -notmatch [regex]::Escape($gate)) {
            Add-Problem "AGENTS.md 目录树缺少闸门：$gate"
        }
    }
}

# ---- 7. 后端分层依赖方向 ----
$javaRoot = Join-Path $projectRoot 'backend\src\main\java\com\luyi\myfirst'
$layerRules = @(
    @{ Layer = 'dao';     Forbidden = @('web') },
    @{ Layer = 'service'; Forbidden = @('web') },
    @{ Layer = 'common';  Forbidden = @('dao', 'service', 'web') }
)
foreach ($rule in $layerRules) {
    $dir = Join-Path $javaRoot $rule.Layer
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    foreach ($f in @(Get-ChildItem -LiteralPath $dir -Recurse -Filter '*.java' -File)) {
        $lines = @(Get-Content -LiteralPath $f.FullName -Encoding UTF8)
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -notmatch '^\s*import\s') { continue }
            foreach ($forbidden in $rule.Forbidden) {
                if ($lines[$i].Contains('import com.luyi.myfirst.' + $forbidden + '.')) {
                    $rel = $f.FullName.Substring($projectRoot.Length + 1)
                    Add-Problem "$($rule.Layer) 层不得 import $forbidden 包：$rel 第 $($i + 1) 行"
                }
            }
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host '11-conventions-check FAILED: 约定文档自洽性或分层依赖不成立' -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "  $problem" -ForegroundColor Red
    }
    exit 1
}

Write-Host ("11-conventions-check PASSED: {0} 份约定文档自洽，后端分层依赖单向" -f $files.Count) -ForegroundColor Green
exit 0
