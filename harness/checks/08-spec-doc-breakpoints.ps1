<#
    闸门 08-spec-doc-breakpoints：单元文档声明的断点与实际 CSS 一致

    docs/specs/wanderchain/ 下的单元文档在响应式小节声明断点，实现则在对应的
    .module.css 里用 @media (max-width) 落地。两者曾经完全平行：文档统一写
    Tailwind 的 768/1024，实现自选了 640/900/1080 等，且文档还出现过
    「与 CSS 现状一致」这类自证句——没有人能靠肉眼发现。

    校验方式：
      1. 文档必须含「真相源：`<css 相对路径>`」，且与下方配对表一致
      2. 从真相源行扫到下一个 ### 标题，提取 [<>≤≥] NNNpx 的断点集合
      3. 从 CSS 提取 max-width: NNNpx 的断点集合
      4. 两个集合必须相等

    通过则 exit 0，不通过则 exit 1，不做任何交互式提问（AGENTS.md §8 约定）。
#>
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

# 配对表：只有登记在此的单元参与校验。新增已对齐的单元时在这里加一行。
$pairs = @(
    @{ Doc = 'docs/specs/wanderchain/homepage-hero.md';               Css = 'frontend/components/home/hero.module.css' },
    @{ Doc = 'docs/specs/wanderchain/homepage-u6-editor-picks.md';    Css = 'frontend/components/home/editor-picks.module.css' },
    @{ Doc = 'docs/specs/wanderchain/homepage-u8-hot-attractions.md'; Css = 'frontend/components/home/hot-attractions.module.css' },
    @{ Doc = 'docs/specs/wanderchain/search-page.md';                 Css = 'frontend/app/search/search.module.css' }
)

$problems = New-Object System.Collections.ArrayList

function Add-Problem {
    param([string]$Message)
    [void]$problems.Add($Message)
}

foreach ($pair in $pairs) {
    $docPath = Join-Path $projectRoot $pair.Doc
    $cssPath = Join-Path $projectRoot $pair.Css

    if (-not (Test-Path -LiteralPath $docPath)) {
        Add-Problem "$($pair.Doc) 不存在"
        continue
    }
    if (-not (Test-Path -LiteralPath $cssPath)) {
        Add-Problem "$($pair.Css) 不存在"
        continue
    }

    $docText = Get-Content -LiteralPath $docPath -Raw -Encoding UTF8
    $cssText = Get-Content -LiteralPath $cssPath -Raw -Encoding UTF8

    # 1. 真相源声明：既给读者看，也是闸门的定位锚点
    $sourceMatch = [regex]::Match($docText, '真相源：`(?<path>[^`]+)`')
    if (-not $sourceMatch.Success) {
        Add-Problem "$($pair.Doc) 缺少「真相源：``<css 路径>``」声明行"
        continue
    }

    $declared = $sourceMatch.Groups['path'].Value.Trim()
    if ($declared -ne $pair.Css) {
        Add-Problem "$($pair.Doc) 的真相源写的是 $declared，配对表登记的是 $($pair.Css)"
    }

    # 2. 响应式小节 = 真相源行到下一个 ### 标题
    $rest = $docText.Substring($sourceMatch.Index)
    $nextHeading = [regex]::Match($rest, '(?m)^### ')
    $section = if ($nextHeading.Success) { $rest.Substring(0, $nextHeading.Index) } else { $rest }

    $docValues = @([regex]::Matches($section, '[<>≤≥]\s*(\d+)px') |
        ForEach-Object { [int]$_.Groups[1].Value } |
        Sort-Object -Unique)
    $cssValues = @([regex]::Matches($cssText, 'max-width:\s*(\d+)px') |
        ForEach-Object { [int]$_.Groups[1].Value } |
        Sort-Object -Unique)

    if ($docValues.Count -eq 0) {
        Add-Problem "$($pair.Doc) 的响应式小节没有任何带 < > ≤ ≥ 前缀的断点声明"
        continue
    }
    if ($cssValues.Count -eq 0) {
        Add-Problem "$($pair.Css) 没有任何 max-width 媒体查询断点"
        continue
    }

    $docStr = $docValues -join ', '
    $cssStr = $cssValues -join ', '
    if ($docStr -ne $cssStr) {
        Add-Problem "$($pair.Doc) 断点 [$docStr] 与 $($pair.Css) 的 [$cssStr] 不一致"
    }
}

if ($problems.Count -gt 0) {
    Write-Host '08-spec-doc-breakpoints FAILED: 文档断点与实际 CSS 不一致' -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "  $problem" -ForegroundColor Red
    }
    exit 1
}

Write-Host ('08-spec-doc-breakpoints PASSED: {0} 份单元文档的断点与实现 CSS 一致' -f $pairs.Count) -ForegroundColor Green
exit 0
