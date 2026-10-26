# Spec Delta

## ADDED Requirements

### Requirement: 封面图的按需出图

编辑推荐与热门景点的封面图 SHALL 按响应式宽度档位请求：每张封面 MUST 声明与实际显示宽度一致的 `sizes` 并生成多档 `srcset`，MUST NOT 对所有设备固定请求同一尺寸的原图。封面 MUST 保持懒加载与异步解码，并在加载中、加载失败时维持声明的宽高比。

#### Scenario: 封面图生成多档 srcset

- **WHEN** 首页渲染编辑推荐或热门景点区块
- **THEN** 每张封面同时带有 `srcset` 与 `sizes`，且 `srcset` 包含多个宽度档位

#### Scenario: sizes 描述与列数断点一致

- **WHEN** 视口宽度跨过区块的列数断点
- **THEN** 卡片实际显示宽度与 `sizes` 声明一致，浏览器据此选出对应档位

#### Scenario: 首屏之外的封面延迟加载

- **WHEN** 封面位于视口之外
- **THEN** 图片带 `loading="lazy"` 与 `decoding="async"`，不参与首屏关键路径

#### Scenario: 图片未就绪或失败时布局不塌陷

- **WHEN** 封面仍在加载或请求失败
- **THEN** 卡片保持声明的宽高比与背景占位，正文位置不发生跳动

#### Scenario: 渲染比例不被宽高属性顶死

- **WHEN** 封面在任意断点下渲染
- **THEN** 渲染宽高比等于 CSS 声明的比例（编辑推荐 4:3，热门景点 1:1）
