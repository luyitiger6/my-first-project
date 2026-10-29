# 样式与视觉约定

适用范围：`frontend/` 子模块的样式层。
本文只写**本仓库特有的取向**；CSS 语言本身的通用规则不在此重述。

## 样式载体

**CSS Modules + 一份全局样式表，不引任何 UI 框架或组件库。**

```
frontend/app/globals.css                设计令牌、重置、容器、极少数全局类
frontend/app/*.module.css               页面级样式（home / auth / search）
frontend/components/<域>/*.module.css    组件独占样式
```

当前共 16 份 `.module.css`。三条归属规则：

1. **组件独享的样式必须写在同名的 `.module.css`**，不进 `globals.css`。`globals.css` 每加一条选择器，都在给所有页面增加一次不可预期的继承。
2. **跨页面复用的只有两样**：设计令牌（CSS 变量）与容器类。其它任何「好几个地方都要用」的样式，先确认是不是该抽成组件。
3. **不写行内样式**。行内样式绕过了令牌与媒体查询，是最容易腐烂的一层。

## 设计令牌

颜色、圆角、阴影、字体一律取自 `globals.css` 的 `:root` 变量，命名前缀固定 `--wc-`：

| 组 | 变量 |
|---|---|
| 背景与卡片 | `--wc-sand`、`--wc-sand-deep`、`--wc-card` |
| 文字 | `--wc-ink`、`--wc-ink-soft`、`--wc-muted` |
| 描边 | `--wc-line` |
| 品牌与强调 | `--wc-green`、`--wc-green-dark`、`--wc-green-soft`、`--wc-accent`、`--wc-accent-soft` |
| 圆角 | `--wc-radius-sm`、`--wc-radius-md`、`--wc-radius-lg` |
| 阴影 | `--wc-shadow` |
| 字体 | `--wc-font-display`、`--wc-font-sans` |

**组件样式里禁止写字面色值**（`#0f5c4e` 这类）。需要新颜色时，先在 `:root` 加一个语义变量，再在组件里引用——否则换主题要 grep 整个仓库。

新变量的命名跟着**用途**走，不跟色值走：`--wc-accent` 而不是 `--wc-orange`。

## 容器与留白

页面横向留白由**唯一一个容器类**负责，定义在 `globals.css`：

```css
.wc-container {
  width: min(1120px, 100% - 40px);
  margin-inline: auto;
}

@media (max-width: 640px) {
  .wc-container {
    width: min(1120px, 100% - 32px);
  }
}
```

关键在于 `100% - 40px` 这个减法：它同时表达了「最宽 1120px」与「左右各留 20px」。窄屏时优先保住留白，所以宽度会先撞到 `100% - 40px`。

**子元素不要再用 `width: min(100%, Npx)` 覆盖父容器。** 这是本仓库已经踩过的坑：父容器已经算过一次内缩，子元素再写一次 `min(100%, ...)` 会把那 40px 留白吃掉，表现为内容贴边，而 `max-width` 看起来完全正常——排查时几乎不会有人怀疑到容器。

宽内容（表格、代码块）需要横向滚动时，给**它自己**加 `overflow-x: auto`，不要改容器的宽度策略。

## 响应式

**desktop-first**，用 `@media (max-width: Npx)` 自上而下累进覆盖。

- 基础样式写桌面态，媒体查询里只写窄屏的差异。
- 断点数值属于**各组件自己的 CSS**，`globals.css` 目前只有 `640px` 一个。
- 单元文档声明断点时必须写「真相源：`<对应 css 路径>`」，且数值与 CSS 完全一致——这一条由 `08-spec-doc-breakpoints.ps1` 校验。本文不列举组件的具体断点，理由是：抄一份数值到这里，等于制造第二真源，而闸门不覆盖本文。

用 `max-inline-size` 而不是 `max-width` 做局部限宽：`08` 会把 CSS 里所有 `max-width: NNNpx` 当作断点扫描，写多了会让该组件的断点集合与文档声明对不上。

## 视觉与可访问性底线

四条，不做协商：

1. **取色只经令牌**。对比度不足时改令牌值，不在组件里就地调深。
2. **键盘可达**。交互元素必须能 Tab 到达、Enter/Space 触发、有可见的 `:focus-visible` 样式。用 `div` 当按钮写 `onClick` 是这条最常见的破口。
3. **图片必须有 `alt`**。装饰性图片写 `alt=""`（空字符串），不是省略。
4. **尊重减弱动效偏好**。`globals.css` 已有：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

新加的动效不要用 `!important` 反向覆盖这一段。持续循环的装饰动画在减弱动效下应当停止，而不只是变慢。

## 真源声明

- `AGENTS.md` — 三层分工、六条硬规则、闸门约定
- `docs/conventions/frontend-conventions.md` — 组件三件套与目录归属，`.module.css` 的落点由它决定
- `openspec/specs/` — 各能力的可验收行为，含首页各区块的可见内容要求

## 依赖现状

无第三方样式依赖。样式全部由 CSS Modules 与全局样式表承担，不引 CSS-in-JS、不引预处理器、不引 UI 组件库。

## 拟引入

- `tailwindcss` — 引入前需同时满足三条：① 现有 16 份 `.module.css` 有明确的迁移或共存方案；② 断点取向从 desktop-first 改为 mobile-first 的代价被明确接受（两者方向相反，只换工具不换写法会得到两套互相打架的断点）；③ 单元文档与 `08-spec-doc-breakpoints.ps1` 的配对表同步改造。缺任一条，只会在仓库里多出一套并行样式体系。
- `shadcn` — 它依赖 Tailwind 与一套自有令牌，因此必须排在 `tailwindcss` 之后；引入前需先把 `--wc-*` 令牌映射到它的主题变量，否则会出现「同一张卡片两种取色来源」。

两项都不在本文承诺落地，只登记引入条件。

## 机械守卫

- `08-spec-doc-breakpoints.ps1` — 已配对的 7 份单元文档所声明的断点，必须与对应 `.module.css` 的 `max-width` 断点集合完全相等
- `04-frontend.ps1` — `next build` 会拦住 `.module.css` 的语法错误与不存在的类引用
- `03-static-guard.ps1` — 禁止 `TODO` 占位与跳过写法
