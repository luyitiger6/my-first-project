<#
    闸门 07-doc-consistency：入口契约与仓库现状一致
    拦截两类「文档没跟上代码」：

      1. AGENTS.md 的闸门清单标记与实际闸门文件对不上
         新增/删除 harness/checks/NN-*.ps1 却忘了改文档，agent 会按错的清单判断流程。
      2. 文档里仍残留已下线技术栈的 token
         换栈后目录树指向不存在的文件，agent 会照着一张错地图动手。

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

# ---- 1. 闸门清单标记 vs harness/checks 实际文件 ----
$agentsDoc = Join-Path $projectRoot 'AGENTS.md'
$actualChecks = @(Get-ChildItem (Join-Path $projectRoot 'harness\checks') -Filter '*.ps1' -File |
    ForEach-Object { $_.BaseName })

if (-not (Test-Path -LiteralPath $agentsDoc)) {
    Add-Problem 'AGENTS.md 不存在'
}
else {
    $agentsText = Get-Content -LiteralPath $agentsDoc -Raw -Encoding UTF8
    $marker = [regex]::Match($agentsText, '<!--\s*harness-checks:(?<list>[^>]*)-->')
    if (-not $marker.Success) {
        Add-Problem 'AGENTS.md 缺少 <!-- harness-checks: ... --> 闸门清单标记'
    }
    else {
        $declared = @($marker.Groups['list'].Value -split '\s+' | Where-Object { $_ })
        foreach ($name in $actualChecks) {
            if ($declared -notcontains $name) {
                Add-Problem "AGENTS.md 闸门清单缺少实际存在的闸门：$name"
            }
        }
        foreach ($name in $declared) {
            if ($actualChecks -notcontains $name) {
                Add-Problem "AGENTS.md 闸门清单写了一个不存在的闸门：$name"
            }
        }
    }
}

# ---- 2. 已下线技术栈 token 残留 ----
# 只列已经真正下线的标识：换栈后这些名字指向不存在的文件。
$bannedTokens = @('App.vue', 'App.spec.ts', 'src/main.ts', 'TodoApp', 'Todo 界面')
foreach ($doc in @('AGENTS.md', 'README.md')) {
    $path = Join-Path $projectRoot $doc
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Problem "$doc 不存在"
        continue
    }
    foreach ($token in $bannedTokens) {
        foreach ($hit in @(Select-String -LiteralPath $path -SimpleMatch -Pattern $token)) {
            Add-Problem "$doc 第 $($hit.LineNumber) 行仍含已下线技术栈 token：$token"
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Host '07-doc-consistency FAILED: 入口契约与仓库现状不一致' -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host "  $problem" -ForegroundColor Red
    }
    exit 1
}

Write-Host ("07-doc-consistency PASSED: 闸门清单与 {0} 个实际闸门一致，无已下线技术栈残留" -f $actualChecks.Count) -ForegroundColor Green
exit 0
