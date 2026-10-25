---
kind: external_dependency
name: CI 编排语言：PowerShell
slug: powershell
category: external_dependency
category_hints:
    - client_constraint
scope:
    - '**'
---

### 角色与集成点
- 全部 Harness 闸门（`run-all.ps1` 及 `checks/NN-*.ps1`）均为 PowerShell 脚本，总控按文件名排序逐个以独立 `powershell.exe -NoProfile -ExecutionPolicy Bypass` 进程执行，任一非 0 退出码即阻断。
- 脚本编码要求 UTF-8 BOM，否则 PowerShell 5.1 会按 GBK 解析导致中文注释乱码。

### 稳定约束
- 每个 check 必须做到零交互、纯 stdout/stderr、exit 0/1；CI 与 agent 环境无法应答交互式提问。
- 新增闸门只需在 `harness/checks/` 下放一个 `NN-<名字>.ps1`，无需修改 `run-all.ps1`。