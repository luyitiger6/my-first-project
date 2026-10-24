<#
    闸门 3/3：静态红线
    拦截 AI 编码里最常见的三种「假通过」：
      1. 留 TODO / FIXME / XXX 占位就宣布完成
      2. 用 System.out.println 代替日志系统
      3. 用 @Disabled 让失败的测试消失

    这三条的共同点是：它们都能让 mvn test 变绿，但护栏的实际强度是零。
#>
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

$srcDir = Join-Path $projectRoot 'src'
if (-not (Test-Path $srcDir)) {
    Write-Host "src directory not found: $srcDir" -ForegroundColor Red
    exit 1
}

$sources = @(Get-ChildItem $srcDir -Recurse -Filter '*.java' -File)
if ($sources.Count -eq 0) {
    Write-Host 'No java sources found - nothing to guard' -ForegroundColor Red
    exit 1
}

$violations = New-Object System.Collections.ArrayList

foreach ($file in $sources) {
    $rel = $file.FullName.Replace($projectRoot + '\', '')
    $lines = [IO.File]::ReadAllLines($file.FullName)

    for ($i = 0; $i -lt $lines.Length; $i++) {
        $lineNo = $i + 1
        $text = $lines[$i]

        if ($text -cmatch 'TODO|FIXME|XXX') {
            [void]$violations.Add("${rel}:${lineNo}  [占位标记] $($text.Trim())")
        }
        if ($text -cmatch 'System\.out\.print') {
            [void]$violations.Add("${rel}:${lineNo}  [禁用 System.out] $($text.Trim())")
        }
        if ($text -cmatch '@Disabled') {
            [void]$violations.Add("${rel}:${lineNo}  [禁止跳过测试] $($text.Trim())")
        }
    }
}

if ($violations.Count -gt 0) {
    Write-Host "Static guard FAILED - $($violations.Count) violation(s):" -ForegroundColor Red
    foreach ($v in $violations) {
        Write-Host "  - $v" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Static guard passed ($($sources.Count) file(s) scanned)" -ForegroundColor Green
exit 0
