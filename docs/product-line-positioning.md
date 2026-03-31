# Pin2pin Atlas 产品线定位

## 当前定位

本仓库当前承接的正式产品线名称是：

`Pin2pin Atlas`

它是 `Pin2pin.ai` 产品家族里负责 datasheet 判读与器件理解的产品线。

当前这个仓库只承接其中最窄的一段：

- 单个 datasheet PDF 判读
- 证据回查
- 参数确认/修正
- 结果导出

## Source Of Truth

品牌架构与统一命名的公司级 source of truth 在：

- [/Users/jilanfang/pin2pin/docs/company/brand-architecture-and-product-line-naming.md](/Users/jilanfang/pin2pin/docs/company/brand-architecture-and-product-line-naming.md)

如果本仓库内文档与公司级命名规范冲突，以该文件为准。

## 历史名称映射

本仓库之前常见的说法包括：

- `Pin2pin.ai` 的第一个 datasheet 工具
- `datasheet workspace`
- `hardware assistant`

当前正式名称统一为：

- `Pin2pin Atlas`

说明：

- 历史泛描述可在归档文档中保留
- 新文档、新页面 metadata、新对外介绍，统一切换为 `Pin2pin Atlas`

## Atlas 的边界

属于本产品线的典型任务：

- 长篇 datasheet 首轮判读
- 关键参数提取
- 条件差异与隐藏限制识别
- 器件理解中的风险提示

这些是 Atlas 产品线能力边界，不代表当前仓库都已实现。

不属于本产品线的主线任务：

- 8D 初稿与异常闭环
- 客诉回复作战流程
- 纯测试验证归档

这些更适合进入 `Pin2pin Fireline` 或未来的 `Pin2pin Proving`。

## 对外一句话

`Pin2pin Atlas` 是面向 datasheet 理解与证据验证的 AI-native 判读工作台。

## Agent 命名方向

如果后续在本仓库里扩 agent，优先使用任务名，而不是抽象大词。

例如：

- `Datasheet Agent`
- `Cross-Part Agent`
- `Pin-to-Pin Agent`
- `Replacement Risk Agent`
