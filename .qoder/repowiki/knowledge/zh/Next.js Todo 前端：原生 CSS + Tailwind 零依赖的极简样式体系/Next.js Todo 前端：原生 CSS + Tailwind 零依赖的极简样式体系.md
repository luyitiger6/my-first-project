---
kind: frontend_style
name: Next.js Todo 前端：原生 CSS + Tailwind 零依赖的极简样式体系
category: frontend_style
scope:
    - '**'
source_files:
    - frontend/app/globals.css
    - frontend/components/TodoApp.tsx
    - frontend/package.json
    - frontend/next.config.ts
---

## 1. 系统/方法

- 框架：Next.js 16（App Router，`app/` 目录）+ React 19 客户端组件。
- 样式方案：**纯原生 CSS**，通过 `next.config.ts` 默认支持；未引入 Tailwind、CSS Modules、styled-components 等任何第三方样式库或预处理器。
- 测试：Vitest + @testing-library/react，与样式无关但位于同一前端工程。

## 2. 关键文件

- `frontend/app/globals.css` — 全局样式与主题变量定义的唯一来源。
- `frontend/components/TodoApp.tsx` — 唯一业务组件，所有 UI class 在此使用。
- `frontend/app/layout.tsx` / `page.tsx` — Next.js App Router 布局与页面入口。
- `frontend/package.json` — 声明依赖中仅有 `next`、`react`、`react-dom`，无样式相关依赖。
- `frontend/next.config.ts` — 仅配置 `output: 'standalone'`，无样式插件。

## 3. 架构与约定

### 3.1 设计令牌（Design Tokens）

全部设计令牌集中在 `globals.css` 的 `:root` 伪类中，采用 CSS 自定义属性形式：

- 字体族：`system-ui, -apple-system, 'Segoe UI', sans-serif`
- 文本色：`#1f2328`
- 背景色：`#f6f8fa`

其余颜色以硬编码十六进制值散布在规则中（如边框 `#d0d7de`、完成态 `#8c959f`、成功绿 `#1a7f37`、错误红 `#cf222e`），未提取为 token。

### 3.2 命名约定

- 使用 **BEM 风格** 的类名前缀 `todo-`：`.todo-app`、`.todo-form`、`.todo-list`。
- 状态类直接附加在元素上：`.done`、`.badge`、`.error`、`.hint`。
- 组件内语义化 class（如 `.title`、`.complete`）与全局样式一一对应。

### 3.3 响应式策略

- 无媒体查询，无断点。
- 通过 `max-width: 480px` 限制 `.todo-app` 宽度，配合 `margin: 0 auto` 居中，实现移动端友好的单列布局。
- 表单使用 Flexbox（`display: flex; gap: 8px`）自适应输入框与按钮宽度。

### 3.4 可访问性

- 组件中使用 `aria-label="新待办标题"` 标注输入框。
- 错误提示使用 `<p className="error" role="alert">` 提供无障碍通知。

### 3.5 构建产物

`next.config.ts` 设置 `output: 'standalone'`，生成最小运行时容器镜像所需的独立产物。

## 4. 约定与约束

- **无第三方样式库**：`package.json` 的 dependencies/devDependencies 中不存在 Tailwind、Sass、PostCSS、CSS-in-JS 等包；样式完全由原生 CSS 承担。
- **单一样式入口**：全局样式仅定义于 `frontend/app/globals.css`，未在组件文件中内联 style 对象（除 JSX 中的 `className` 外）。
- **Tailwind 未启用**：仓库中不存在 `tailwind.config.*` 文件，也未在 `next.config.ts` 中注册 Tailwind 插件。
- **CSS 不模块化**：所有类名均为全局作用域，组件通过固定类名（如 `todo-app`、`todo-form`）与全局样式绑定，而非 CSS Modules 或 scoped 样式。
- **颜色硬编码**：除 `:root` 中的少量基础变量外，其他颜色值以字面量散布在规则中，未见统一的调色板文件或设计令牌表。
- **无主题切换机制**：未发现 dark mode、CSS 变量动态切换或按主题加载样式的逻辑。