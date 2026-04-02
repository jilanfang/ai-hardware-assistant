# Atlas 强卖点 / Gap / Roadmap 对照矩阵

> 目的：
> 在已有论坛机会映射基础上，进一步把外部质疑逐项对照到当前 `Atlas` 的 PRD、产品设计、交互规则和技术架构。
>
> 输出目标不是再写一版策略散文，而是得到一张可直接用于：
>
> - 对产品设计
> - 对对外表达
> - 对 roadmap 排序
>
> 的检查矩阵。

## 1. 使用方式

每一项都按四层判断：

1. `外部质疑`
2. `当前设计是否已覆盖`
3. `如果已覆盖，是否已经足够强到能拿来卖`
4. `如果未完全覆盖，缺口应该进入哪一层 roadmap`

状态定义：

- `Strong now`
  - 当前产品定义和架构已经形成明确差异，可以直接当卖点讲
- `Present but soft`
  - 文档和方向已明确，但产品体验或工程实现还不够硬，讲太满会虚
- `Gap`
  - 当前 phase-1 还没有真正覆盖，不能拿来当已成立能力

## 2. 总体判断

当前 `Atlas` 最值得强化的，不是“模型能力领先”。

当前最值得强化的是三条已经成立、而且和论坛质疑直接对打的线：

1. `evidence-first`
2. `result-first workspace`
3. `explicit uncertainty / degraded states`

当前最大 gap 主要集中在三件事：

1. 参数值和适用条件的绑定还不够一等化
2. variant / package / part-family 边界暴露还不够强
3. evidence precision 与解析质量表达还不够硬

## 3. 对照矩阵

### 3.1 “AI 会编假的参数、页码、引用”

#### 外部质疑
- 用户不怕 AI 偶尔出错。
- 用户怕的是错得像真的，而且没法快速打回原文核对。

#### 当前设计对应
- `mvp-prd.md`
  - 明确写了 traceability standard
  - 明确要求 page-aware evidence jumps 和 source-linked parameters / conclusions
- `product-design.md`
  - 把 evidence-linked interaction 定义成核心 trust-building flow
- `interaction-details.md`
  - 把验证动作定义成核心交互
- `technical-architecture.md`
  - 把 evidence 作为 central architectural primitive

#### 判断
- 状态：`Strong now`

#### 为什么这是当前强卖点
- 这不是局部功能。
- 这是产品主结构、交互主路径和架构主原则同时支持的能力。
- 可以直接对外讲成：
  - 不是只给答案
  - 而是默认给验证路径

#### 还缺什么
- 需要继续把 evidence precision 做硬
- 但卖点本身已经成立

#### 建议进入 roadmap 的层级
- `P0 hardening`

### 3.2 “不读取当前 datasheet，就不可信”

#### 外部质疑
- 模型记忆不可审计。
- 用户只愿意接受围绕当前文档的分析，而不愿意接受“模型应该知道”。

#### 当前设计对应
- `README.md`
  - 当前产品就是 single-PDF datasheet workspace
- `mvp-prd.md`
  - upload one datasheet PDF
  - grounded follow-up questions
- `technical-architecture.md`
  - document-grounded datasheet reading
  - provider-native PDF direct path + fallback modality

#### 判断
- 状态：`Strong now`

#### 为什么这是当前强卖点
- 当前产品不是 generic chat。
- 输入对象、任务对象、grounding 对象都锁在当前 PDF 上。
- 这和论坛里的“必须围绕当前 datasheet 才值得信”高度一致。

#### 还缺什么
- 可以把当前 runtime / modality attribution 在产品里讲得更清楚
- 让用户知道这次结果到底是 PDF direct 还是 fallback path

#### 建议进入 roadmap 的层级
- `P0 hardening`

### 3.3 “PDF 很难，表格、图、脚注、双栏会坏”

#### 外部质疑
- 用户不是只在问模型聪不聪明。
- 用户在问系统到底怎么读 PDF，以及这份 PDF 可能在哪些地方出错。

#### 当前设计对应
- `datasheet-dual-route-reading-strategy.md`
  - direct-to-llm + parse-to-llm 双路线
  - parser 不再作为主结论源，而是增强链路
- `technical-architecture.md`
  - PDF direct path
  - image-rendered multimodal fallback
  - parser-assisted parameter extraction and evidence enhancement
- `interaction-details.md`
  - explicit degraded-state rule

#### 判断
- 状态：`Present but soft`

#### 为什么还不是完全强卖点
- 设计逻辑是对的。
- 工程路径也在。
- 但从用户视角看，现在更像“系统内部如何处理”的技术方案，而不是一个已经被产品充分表达清楚的可感知价值。
- 用户还不一定能直接理解：
  - 这份 PDF 为什么 partial
  - 哪些页是高风险页
  - 当前结果到底被哪种 ingest 局限影响

#### 主要 gap
- 缺更明确的 PDF-quality / parse-quality 暴露
- 缺更清楚的“为什么需要你重点核查这里”的解释
- 缺把复杂页、表格页、脚注页标成风险节点的产品层表达

#### 建议进入 roadmap 的层级
- `P0-P1`

### 3.4 “真正难的是参数和条件绑在一起”

#### 外部质疑
- 单独抽一个数字不够。
- 用户要知道这个数字在哪种条件下成立，适用于哪个 variant，属于 typical 还是 guaranteed。

#### 当前设计对应
- `datasheet-dual-route-reading-strategy.md`
  - 七步阅读骨架
  - 强制解释 `Absolute Maximum`、`Typical`、test condition 等误读点
- `product-design.md`
  - engineering review and risks
- `mvp-prd.md`
  - hidden conditions and related references are part of the problem statement

#### 判断
- 状态：`Present but soft`

#### 为什么现在还不能当最强卖点讲
- 方法论层已经很清楚。
- 报告叙事上也有意识。
- 但从当前产品定义和架构看，“参数值 + 条件 + 适用范围”还没有被明确提升成稳定、显式、结构化的一等对象。
- 现在更多还是：
  - 靠 report / review / prompt 解释
  - 而不是靠结果模型强约束

#### 主要 gap
- parameter item 需要更强的 condition binding
- 需要更明确的 `typ / min / max / guaranteed / abs max / rec op condition` 区分
- 需要更明确的适用 variant / package / test setup 暴露

#### 建议进入 roadmap 的层级
- `P1`

### 3.5 “聊天越聊越漂”

#### 外部质疑
- 多轮聊天会让答案越来越像模型顺嘴编的。
- 用户不想把验证链拖进一个无限聊天窗口。

#### 当前设计对应
- `product-design.md`
  - user should not see an empty chat interface by default
- `interaction-details.md`
  - result-first rule
  - follow-up answers must stay bounded by current evidence
  - one task thread, not detached feature cards
- `mvp-prd.md`
  - first-pass result first, follow-up later

#### 判断
- 状态：`Strong now`

#### 为什么这是当前强卖点
- 这条不是“减少聊天”，而是把聊天放回结果之后。
- 它直接回应了论坛对 chat-first 工具的反感。
- 这也是当前 Atlas 很容易和通用 AI 拉开的一条设计线。

#### 还缺什么
- 需要在跟进设计时继续守住，不要被后续功能加回 chat-first

#### 建议进入 roadmap 的层级
- 不新增功能，`持续守边界`

### 3.6 “查一个参数不如 Ctrl+F”

#### 外部质疑
- 如果只是替代单点搜索，价值太弱。
- 用户不会为了一个弱替代动作切换工具。

#### 当前设计对应
- `mvp-prd.md`
  - 不是只查参数，还要 summary、review、grounded export、follow-up
- `product-design.md`
  - 固定结果顺序是 summary -> review -> parameters -> export -> follow-up
- `interaction-details.md`
  - result-first, export tied to reviewed output

#### 判断
- 状态：`Present but soft`

#### 为什么还没完全变成强卖点
- 当前产品逻辑确实不只是查一个数。
- 但“比 Ctrl+F 更值得用”的价值链，还没有被彻底打成一句很硬的产品感受。
- 用户需要更明显感到：
  - 少了哪些切换
  - 少了哪些复制粘贴
  - 少了哪些重组和整理动作

#### 主要 gap
- 缺更清晰的 workflow delta 表达
- 缺更强的 reviewed export / reusable artifact 心智
- 缺真实用例证明“first pass + verify + export”比手工流程更顺

#### 建议进入 roadmap 的层级
- `P1`

### 3.7 “用户不怕不知道，怕系统装懂”

#### 外部质疑
- 只要 UI 足够平滑，错误就更危险。
- 工程用户希望系统把不确定性说出来。

#### 当前设计对应
- `interaction-details.md`
  - degraded-state rule
  - evidence approximate
  - grounding exceeded
- `product-design.md`
  - successful / degraded / partial / failure state 都必须显式
- `technical-architecture.md`
  - explicit degraded states are part of trust architecture

#### 判断
- 状态：`Strong now`

#### 为什么这是当前强卖点
- 很多产品把“像没问题一样顺滑”当优点。
- 但在 datasheet 场景，这恰好是风险。
- Atlas 现在的文档和架构方向反而把“说清楚不知道”当产品能力。

#### 还缺什么
- 可以进一步把 degraded reasons 说得更具体
- 但方向和主能力已经成立

#### 建议进入 roadmap 的层级
- `P0 hardening`

### 3.8 “variant / package / family datasheet 很容易混”

#### 外部质疑
- 论坛里的多个失败案例，都不是简单文本错误。
- 本质上是 family datasheet、variant、package、pinout、lifecycle 被混了。

#### 当前设计对应
- `datasheet-dual-route-reading-strategy.md`
  - 已经意识到 variant / package / layout / control interface 的重要性
- `mvp-prd.md`
  - hidden conditions and related references are product problem
- `technical-architecture.md`
  - current model still centered on first-pass datasheet analysis

#### 判断
- 状态：`Gap`

#### 为什么这是 gap
- 当前产品方法论知道这件事重要。
- 但从结果模型、UI 表达、验证层级看，还没有一个足够硬的“适用边界暴露机制”。
- 也就是说，系统知道这是风险，但还没有把它做成一眼可见的产品对象。

#### 主要 gap
- per-parameter applicability scope
- variant-aware warnings
- package / pinout mismatch surfacing
- family-level ambiguity exposure

#### 建议进入 roadmap 的层级
- `P1-P2`

### 3.9 “批量预筛选比单文档问答更有价值”

#### 外部质疑
- 真正高价值任务常常是：
  - 多 datasheet
  - 批量字段提取
  - preselection
  - 再人工复核

#### 当前设计对应
- `README.md`
  - current shipped scene is single PDF only
- `mvp-prd.md`
  - phase-1 scope lock is datasheet-only, single PDF
- `task_plan.md`
  - limited multi-document grounding only after single-document loop proves itself

#### 判断
- 状态：`Gap by design`

#### 为什么现在不能算缺陷
- 这不是漏做。
- 这是当前 wedge 的主动冻结边界。
- 如果现在抢做，会把单文档 trust loop 的问题直接放大。

#### 主要 gap
- multi-document workspace model
- cross-document normalization
- verification queue for bulk extraction

#### 建议进入 roadmap 的层级
- `P2 after phase-1 trust loop`

## 4. 当前最能拿来卖的三条线

### 4.1 Evidence-first datasheet workspace

这是当前最硬的一条。

不是“会回答 datasheet 问题的 AI”，而是：

`一个围绕当前 PDF 给出可回查结果的 evidence workspace。`

### 4.2 Result-first, not chat-first

这是第二条强差异。

不是把工程任务塞进聊天框，而是：

`先给可验证 first pass，再允许 bounded follow-up。`

### 4.3 Honest uncertainty

这是第三条最该强化的线。

不是“把结果抹平”，而是：

`partial 就说 partial，approximate 就说 approximate，不拿流畅感换信任。`

## 5. 当前最该补硬的三条线

### 5.1 参数值和适用条件的一等化

目标不是在 report 里多写几句解释。

目标是把：

- value
- condition
- range type
- applicability

做成结果层稳定对象。

### 5.2 Variant / package / family ambiguity exposure

目标不是后台更聪明。

目标是把“这条结论适用于谁，不适用于谁”更早暴露给用户。

### 5.3 PDF / parse / evidence quality 的可见化

目标不是只在内部知道这份 PDF 难读。

目标是让用户看懂：

- 为什么这里需要重点核查
- 哪些页的证据强，哪些页弱
- 当前结果受哪些 ingest 限制影响

## 6. Roadmap 建议分层

### P0：把已成立的卖点做硬

- evidence precision
- degraded-state specificity
- runtime / modality attribution clarity
- reviewed vs unreviewed trust labels
- grounded follow-up 边界稳定性

### P1：把专业用户最敏感的坑做成显式对象

- condition-bound parameters
- `typ / max / guaranteed / abs max / rec op` distinctions
- variant / package / family ambiguity exposure
- review-needed parameter states

### P2：在单文档 trust loop 稳住后扩更大工作面

- multi-document preselection
- cross-vendor field normalization
- comparison / candidate filtering workspace
- bulk extraction + verification queue

## 7. 对当前设计的结论

如果只看论坛质疑，最容易得出的错误反应是：

- 去追求更强模型
- 去做更像聊天 AI 的体验
- 去扩大能力范围证明自己不是小工具

这三条都不是当前正确方向。

当前正确方向是：

1. 把已经成立的 trust architecture 讲清楚
2. 把 evidence-first、result-first、honest uncertainty 做硬
3. 把条件绑定、variant 边界、evidence precision 这些真正伤信任的点补上
4. 在单文档 trust loop 稳定后，再去谈多文档预筛和更广器件工作流

一句话：

`不是把 Atlas 做得更像通用 AI，而是把它做得更像一个工程师愿意反复打开的可信工作面。`

