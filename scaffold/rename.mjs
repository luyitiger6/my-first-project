#!/usr/bin/env node
/**
 * scaffold/rename.mjs —— 工作区身份改名脚本
 *
 * 只替换工作区自身的展示名与 slug，不触碰两个子模块的项目身份：
 *
 *   node scaffold/rename.mjs --name <新 slug> --display "<新展示名>"
 *   例：node scaffold/rename.mjs --name todo-workbench --display "Todo Workbench"
 *
 * 规则（对应 openspec specs/workspace-scaffold 的契约）：
 * - --name 要求 kebab-case；--display 去空白后 1..60 字符且不含换行；缺失或非法即退出码 1
 * - 只改 AGENTS.md 与 README.md，不进入 backend/、frontend/ 子模块，不改 .gitmodules
 * - 显式拒绝 --package：应用身份（包名 / artifactId / 前端包名）应在 backend、frontend 仓库内各自改名
 * - 新值与旧值相同、或文档中检测不到旧工作区身份时拒绝执行（防止空操作与二次执行）
 *
 * 执行成功后请运行 `powershell -File harness\run-all.ps1` 验收。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 旧工作区身份（刻在模板中，单一事实源）----
const OLD = {
  display: 'AIWorkSpace', // 展示名
  slug: 'ai-workspace',   // 仓库 / 文档 slug
};

// ---- 替换范围：只有工作区自己的两份文档 ----
const FILES = ['AGENTS.md', 'README.md'];

const USAGE = '用法: node scaffold/rename.mjs --name <新 slug> --display "<新展示名>"';
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--name') out.name = argv[i + 1];
    else if (argv[i] === '--display') out.display = argv[i + 1];
  }
  return out;
}

// ---- 拒绝应用身份改名参数（在其它校验之前，避免被参数缺失掩盖）----
if (process.argv.slice(2).includes('--package')) {
  console.error('拒绝执行: --package 不属于工作区改名范围');
  console.error('应用身份（Java 包名 / Maven artifactId / 前端包名）应在 backend、frontend 仓库内分别改名，');
  console.error('工作区只负责自己的展示名与 slug，且不会进入子模块目录');
  process.exit(1);
}

const { name, display } = parseArgs(process.argv.slice(2));

// ---- 参数校验 ----
if (!name) {
  console.error(`${USAGE}\n缺少必需参数 --name`);
  process.exit(1);
}
if (!display) {
  console.error(`${USAGE}\n缺少必需参数 --display`);
  process.exit(1);
}
if (!KEBAB_RE.test(name)) {
  console.error(`参数 --name 非法: "${name}"（要求 kebab-case，如 todo-workbench）`);
  process.exit(1);
}
const newDisplay = display.trim();
if (newDisplay.length < 1 || newDisplay.length > 60 || /[\r\n]/.test(display)) {
  console.error(`参数 --display 非法: "${display}"（要求去空白后 1..60 字符且不含换行）`);
  process.exit(1);
}

// ---- 同值改名拒绝：否则脚本会“成功”却什么都没改 ----
if (name === OLD.slug) {
  console.error(`参数 --name 与当前 slug 相同（${OLD.slug}），无需改名`);
  process.exit(1);
}
if (newDisplay === OLD.display) {
  console.error(`参数 --display 与当前展示名相同（${OLD.display}），无需改名`);
  process.exit(1);
}

// ---- 读取待改文件（缺文件即失败，不猜测）----
const contents = new Map();
for (const rel of FILES) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) {
    console.error(`替换清单中的文件不存在: ${rel}`);
    process.exit(1);
  }
  contents.set(rel, readFileSync(file, 'utf8'));
}

// ---- 二次执行防护：AGENTS.md 必须仍带旧工作区身份 ----
if (!contents.get('AGENTS.md').includes(OLD.display) && !contents.get('AGENTS.md').includes(OLD.slug)) {
  console.error(`未在 AGENTS.md 中发现旧工作区身份（${OLD.display} / ${OLD.slug}），仓库可能已改名过；`);
  console.error('拒绝重复执行。如需再次改名，请先把这两个 token 恢复为模板原值');
  process.exit(1);
}

// ---- 单次扫描替换：避免“新值里含旧 token”造成级联替换 ----
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const TOKEN_RE = new RegExp(`${escapeRegExp(OLD.display)}|${escapeRegExp(OLD.slug)}`, 'g');

for (const rel of FILES) {
  const before = contents.get(rel);
  let replaced = 0;
  const after = before.replace(TOKEN_RE, (token) => {
    replaced += 1;
    return token === OLD.display ? newDisplay : name;
  });
  writeFileSync(join(ROOT, rel), after, 'utf8');
  console.log(`替换完成: ${rel}（${replaced} 处）`);
}

console.log(`\n工作区改名完成: ${OLD.display} -> ${newDisplay}，slug ${OLD.slug} -> ${name}`);
console.log('子模块与 .gitmodules 未改动；应用身份改名请在 backend / frontend 仓库内进行');
console.log('请运行 powershell -File harness\\run-all.ps1 验收');
