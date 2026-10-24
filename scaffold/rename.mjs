#!/usr/bin/env node
/**
 * scaffold/rename.mjs —— 模板改名脚本
 *
 * 把刻在模板中的作者身份标识（项目名 / groupId / 包名）替换为使用者的项目身份：
 *
 *   node scaffold/rename.mjs --name <新项目名> --package <新包名>
 *   例：node scaffold/rename.mjs --name demo-app --package com.demo.app
 *
 * 规则（对应 openspec specs/scaffold-rename 的契约）：
 * - --name 要求 kebab-case，--package 要求点分小写且至少两段；缺失或非法即退出码 1
 * - 只替换下方 FILES 清单里的文件，不碰 openspec/、.git 与构建产物
 * - 文本替换完成后重命名两个 Java 包目录
 * - 模板身份标识不存在时拒绝执行（防止对已改名仓库二次执行）
 * 执行成功后请运行 `powershell -File harness\run-all.ps1` 验收。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---- 参数解析与校验 ----
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--name') out.name = argv[i + 1];
    if (argv[i] === '--package') out.package = argv[i + 1];
  }
  return out;
}

const USAGE = '用法: node scaffold/rename.mjs --name <新项目名> --package <新包名>';
const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/; // kebab-case
const PACKAGE_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]+)+$/; // 点分小写，至少两段

const { name, package: pkg } = parseArgs(process.argv.slice(2));
if (!name) {
  console.error(`${USAGE}\n缺少必需参数 --name`);
  process.exit(1);
}
if (!pkg) {
  console.error(`${USAGE}\n缺少必需参数 --package`);
  process.exit(1);
}
if (!KEBAB_RE.test(name)) {
  console.error(`参数 --name 非法: "${name}"（要求 kebab-case，如 demo-app）`);
  process.exit(1);
}
if (!PACKAGE_RE.test(pkg)) {
  console.error(`参数 --package 非法: "${pkg}"（要求点分小写且至少两段，如 com.demo.app）`);
  process.exit(1);
}

// ---- 旧名 → 新值 映射（旧值刻在模板中，单一事实源；顺序敏感）----
const OLD = {
  project: 'my-first-project', // 项目名 / artifactId / spring.application.name / 文档标题
  group: 'com.luyi',           // Maven groupId / Java 包名前缀
  groupPath: 'com/luyi',       // 文档与目录地图中的包路径形式
  artifact: 'myfirst',         // Java 包名末段 / 包目录末段
};
const pkgSegments = pkg.split('.');
const NEW = {
  project: name,
  group: pkgSegments.slice(0, -1).join('.'), // groupId 取包名去掉末段
  groupPath: pkgSegments.slice(0, -1).join('/'),
  artifact: pkgSegments[pkgSegments.length - 1],
};

// ---- 替换文件清单（模板身份点，不碰 openspec/ 与 .git）----
const FILES = [
  'AGENTS.md',
  'README.md',
  'backend/pom.xml',
  'backend/src/main/resources/application.yml',
  'backend/src/main/java/com/luyi/myfirst/Application.java',
  'backend/src/main/java/com/luyi/myfirst/domain/Todo.java',
  'backend/src/main/java/com/luyi/myfirst/domain/TodoService.java',
  'backend/src/main/java/com/luyi/myfirst/web/TodoController.java',
  'backend/src/test/java/com/luyi/myfirst/ApplicationContextTest.java',
  'backend/src/test/java/com/luyi/myfirst/domain/TodoServiceTest.java',
];

// ---- 防御：模板身份标识必须存在（防止对已改名仓库二次执行）----
const marker = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
if (!marker.includes(OLD.project)) {
  console.error(`未在 AGENTS.md 中发现模板身份标识 "${OLD.project}"，仓库可能已改名过；拒绝重复执行`);
  process.exit(1);
}

// ---- 逐文件文本替换 ----
for (const rel of FILES) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) {
    console.error(`替换清单中的文件不存在: ${rel}`);
    process.exit(1);
  }
  let content = readFileSync(file, 'utf8');
  for (const [oldValue, newValue] of [
    [OLD.project, NEW.project],
    [OLD.group, NEW.group],
    [OLD.groupPath, NEW.groupPath],
    [OLD.artifact, NEW.artifact],
  ]) {
    content = content.split(oldValue).join(newValue);
  }
  writeFileSync(file, content, 'utf8');
  console.log(`替换完成: ${rel}`);
}

// ---- 包目录重命名（在文本替换之后）----
const DIRS = [
  'backend/src/main/java/com/luyi/myfirst',
  'backend/src/test/java/com/luyi/myfirst',
];
const newPackagePath = pkgSegments.join('/');
for (const rel of DIRS) {
  const from = join(ROOT, rel);
  if (!existsSync(from)) {
    console.error(`包目录不存在: ${rel}`);
    process.exit(1);
  }
  const to = join(ROOT, rel.replace('com/luyi/myfirst', newPackagePath));
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  console.log(`目录重命名: ${rel} -> ${newPackagePath}`);
  // 清理空的旧父目录（com/luyi 与 com）：仅当目录为空时删除，非空则保留
  const removeDirIfEmpty = (dir) => {
    try { if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true }); } catch { /* 不存在或非空 */ }
  };
  removeDirIfEmpty(dirname(from));
  removeDirIfEmpty(dirname(dirname(from)));
}

console.log(`\n改名完成: ${OLD.project} -> ${NEW.project}，包名 ${OLD.group}.${OLD.artifact} -> ${pkg}`);
console.log('请运行 powershell -File harness\\run-all.ps1 验收');
