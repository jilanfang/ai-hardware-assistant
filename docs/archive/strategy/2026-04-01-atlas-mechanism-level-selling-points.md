# Atlas 机制级卖点拆解

> 目的：
> 不再停留在 `evidence-first`、`result-first` 这类抽象层。
>
> 这份文档把 `Atlas` 当前已经存在的功能点、技术机制和隐藏工程设计拆成更细粒度卖点，回答三个问题：
>
> 1. 我们到底做了什么
> 2. 这件事解决了什么用户不信任
> 3. 为什么这不是 generic chat LLM 默认就有的能力

## 1. 这次拆解的范围

本次只覆盖当前 repo 内已有文档、测试或实现可支撑的机制，不把未来想法写成现有能力。

重点覆盖：

- 类目模板与暗知识注入
- RF 专用阅读方法和字段约束
- staged 双模型管线
- 参数冲突裁判机制
- 参数 provenance 和状态分层
- reviewed / unreviewed / user-corrected 导出
- 运行路径可见化
- dual-route 阅读策略
- grounded follow-up 约束

## 2. 不要再只讲 “Atlas 比 chat 更可信”

这句话太粗。

更准确的说法应该是：

`Atlas 不是一个聊天模型套壳，而是一套围绕 datasheet trust loop 拼出来的机制集合。`

用户不一定先理解架构，但他一定能感受到这些机制带来的差别：

- 输出是不是按器件类目组织
- 参数是不是按工程字段落位
- 冲突是不是被暴露
- 待确认项是不是被单独标出来
- 导出是不是能区分“AI 说的”和“人工改过的”
- 这次结果到底是怎么跑出来的

## 3. 机制级卖点总表

| 机制 | 作用 | 对应用户痛点 | 当前可卖程度 |
|------|------|--------------|--------------|
| RF / Wi-Fi / Cellular / Serial Flash 类目模板 | 把输出限制在工程字段框架里 | 模型会泛化、乱写、漏关键字段 | Strong now |
| RF 暗知识包注入 | 让模型按 RF 工程阅读法解释，而不是通用摘要 | 用户怕模型不懂 test condition、线性度、模式差异 | Strong now |
| 标准字段名 + 字段别名映射 | 把不同说法落到稳定字段 | 用户怕不同 datasheet 说法不统一，无法复用 | Strong now |
| keyParameters / designFocus / risks / openQuestions 槽位分离 | 不让风险、建议、参数混在一起 | 用户怕“待确认问题”被伪装成参数真值 | Strong now |
| staged 双模型管线 | 快参数先出，完整报告后到 | 用户既要快，也怕一把梭输出太慢或太漂 | Present but soft |
| 参数冲突裁判机制 | fast/report 冲突时不强行合并 | 用户怕不同路径给出不同答案却被系统抹平 | Strong now |
| 参数状态分层 | confirmed / needs_review / user_corrected | 用户怕 AI 结果和人工修正混在一起 | Strong now |
| 参数 provenance | 标明来自 fast pass、report pass、裁判或人工 | 用户怕不知道当前值是怎么来的 | Strong now |
| reviewed export | 导出时保留状态和证据，不做干净但虚假的表 | 用户怕导出后丢失信任上下文 | Strong now |
| runtime attribution | 告诉用户 provider/model、pdf direct / fallback、single / staged | 用户怕不知道系统这次到底怎么跑的 | Strong now |
| bounded follow-up | 追问只围绕当前 report / parameter store / evidence | 用户怕聊天越聊越漂 | Strong now |
| dual-route reading | direct-to-llm 主阅读 + parse-to-llm 补强 | 用户怕 PDF 难读导致系统“一路错到底” | Present but soft |

## 4. 类目模板不是 prompt 花活，而是产品结构层

### 4.1 我们不是只让模型“总结 datasheet”

当前系统已经有明确的参数模板：

- `wifi`
- `cellular-3g4g5g`
- `rf-general`
- `serial-flash`
- `power`
- `audio`
- `generic-fallback`

这些模板不是 UI 文案，而是直接约束输出结构的机制。

例如 `wifi` 模板要求的字段不是泛泛的：

- `RF Type`
- `Frequency Coverage`
- `TX Linear Output Power`
- `EVM / ACLR Condition`
- `RX Gain / Noise Figure / Bypass Loss`
- `Control Mode / Truth Table`
- `Supply Voltage`
- `Package / Case`

这意味着系统不是让模型自由发挥“看到了什么”，而是要求它把内容压进工程上有意义的字段框架里。

### 4.2 这解决的不是“格式整齐”，而是“减少泛化瞎写”

论坛里最常见的问题不是模型不会说，而是会说得太宽、太泛、太顺。

参数模板的价值在于：

- 强迫模型围绕真实字段组织输出
- 降低用 `Features`、`Specs` 这类模糊词混过去的空间
- 让后续参数确认、导出、比较都有稳定落点

### 4.3 对外怎么讲

不要讲：

- “我们有很多 prompt”

要讲：

- `Atlas 会先识别器件类目，再把结果压进对应工程字段框架，而不是给你一段泛化总结。`

## 5. RF 暗知识注入，是领域阅读方法的产品化

### 5.1 我们有一层 RF 知识包，不是只靠模型临场猜

当前 prompt bundle 已经会按类目注入知识包。

例如 RF 相关任务会注入：

- `rf-overview`
- `rf-reading-method`
- `rf-misread-traps`
- 对应子类模板，如 `wifi-fem`、`cellular-pam`、`rf-switch`、`lna`

而且文档里已经明确写了很多专业判断规则，例如：

- `Absolute Maximum` 不能当工作条件
- `Typical` 不等于 `guaranteed`
- RF 数字必须连同 mode、band、bandwidth、modulation 一起理解
- Wi-Fi FEM 不能被误分类成 cellular PAM

### 5.2 这不是“加知识”这么简单

它解决的是一个更实在的问题：

`通用 LLM 会把领域判断退化成语义近似。`

而 RF 场景最怕的就是语义近似：

- 饱和输出和线性输出混了
- 2.4G 和 5G 条件混了
- EVM / ACLR 条件没带出来
- RFFE / MIPI 控制兼容性被省掉
- layout / thermal 被当成边角料

### 5.3 对外怎么讲

不要讲：

- “我们针对 RF 做了优化”

太空。

更准的说法是：

- `Atlas 对 RF 不是用通用摘要法，而是按 RF 工程阅读法去看：先角色、再频段、再线性条件、再控制接口、再 layout 和 thermal。`

## 6. 标准字段名 + 字段别名映射，是对抗 datasheet 说法漂移的关键

### 6.1 当前系统不只是有字段，还显式维护了 alias mapping

例如：

- `Frequency Coverage` 可以映射 `frequency range`、`supported bands`、`2.4g`、`5g`
- `TX Linear Output Power` 可以映射 `tx output power`、`linear output power`
- `EVM / ACLR Condition` 可以映射 `evm`、`aclr`、`mcs`、`modulation`、`bandwidth`

这说明当前系统已经不是只会“抽字符串”，而是在做一层字段语义归并。

### 6.2 这件事为什么值钱

论坛里很多人真正需要的是：

- 多份 datasheet
- 不同厂商
- 不同写法
- 最后能落成统一字段

如果没有 alias mapping，这一步根本走不通。

所以这不是后期 comparison 才需要的基础设施，而是当前单文档 trust loop 里就很关键的资产。

### 6.3 对外怎么讲

- `不同 datasheet 用不同说法，Atlas 会先把它们压到同一套工程字段，而不是把原文措辞直接原样吐给你。`

## 7. 我们不是输出一个 report，而是在做“槽位隔离”

### 7.1 当前 report contract 已经把不同语义层拆开了

系统明确区分：

- `keyParameters`
- `designFocus`
- `risks`
- `openQuestions`
- `publicNotes`

而且 prompt contract 里已经写得很硬：

- `keyParameters` 只放结构化参数真值
- `designFocus` 放设计关注点、trade-off、layout / thermal / matching
- `risks` 放风险、误读和兼容性问题
- `openQuestions` 放资料未覆盖和待确认项

### 7.2 这条机制解决什么

论坛里有个核心痛点：

`AI 会把不确定判断、工程建议、外部补充、参数真值全混在一起。`

一旦混在一起，用户就不知道哪句能拿去用，哪句只是提醒。

Atlas 这套槽位设计，本质是在做：

`不让不同可信度的内容共享一个语义地位。`

### 7.3 对外怎么讲

- `Atlas 不把“参数”“风险”“设计提醒”“待确认问题”糊成一段总结，它们在结果里是分槽位的。`

## 8. staged 双模型管线，不是炫技，是把“快”和“稳”拆开

### 8.1 当前系统已经支持两种模式

- `single`
- `staged`

其中 `staged` 不是一句空话，而是拆成了：

- identity provider
- fast parameter provider
- report provider
- arbitration provider
- follow-up provider

### 8.2 staged 的真实意义

很多工具要么：

- 先给个快但很虚的答案
- 要么慢慢跑一个完整结果

而 `Atlas` 的 staged 设计在做的是：

- 先出快参数，给用户第一轮可看内容
- 再出完整报告，补上下文和更完整结论
- 如果两边打架，不假装它们一致

### 8.3 这条机制解决什么

它不是简单地“多模型更高级”。

它解决的是两个冲突需求：

- 工程用户想要早点看到关键参数
- 工程用户又怕第一眼看到的东西被当成最终结论

staged 模式的价值就在这里：

`先给第一轮，再显式告诉你完整分析是否已经到位。`

### 8.4 当前卖点状态

这条机制已经存在，也有测试覆盖。
但在产品表达上还没完全讲透。

因为用户现在不一定知道：

- staged 不是普通 loading
- fast pass 和 full report 是不同阶段
- 这件事和信任边界直接相关

所以它是：

- 机制上已成立
- 表达上 `Present but soft`

## 9. 双 LLM + 裁判，不是为了复杂，而是为了不抹平冲突

### 9.1 当前系统真有参数裁判机制

当前 `server-analysis` 里已经有：

- fast draft
- report draft
- conflict detection
- `arbitrateParameterConflict`
- `ParameterArbitrationNote`

而且测试里已经覆盖了典型情况：

- fast pass 给出一个值
- full report 给出另一个值
- arbitration 决定 `prefer_fast` / `prefer_report` / `keep_both_needs_review` / `insufficient_evidence`

### 9.2 这个机制真正值钱的地方

generic chat 工具在冲突时常见做法只有两种：

- 悄悄选一个
- 把两个值揉成一段模糊解释

Atlas 当前机制更像工程工作流：

- 承认冲突存在
- 记录冲突
- 给出裁判说明
- 最终仍可能标成 `needs_review`

这非常关键，因为它把“模型不一致”从隐藏 bug，变成显式信任状态。

### 9.3 对外怎么讲

不要讲：

- “我们用了多模型 ensemble”

还是太 AI 味。

更准确的讲法是：

- `当快参数和完整报告打架时，Atlas 不会偷偷选一个，而是显式做冲突裁决，并把结果标成待回查。`

## 10. 参数 provenance 和状态分层，是工作流能力，不是 UI 标签

### 10.1 当前系统已经有清楚的参数状态

参数状态不是一个布尔值，而是：

- `confirmed`
- `needs_review`
- `user_corrected`

同时还带 provenance：

- `gpt4o_fast_pass`
- `gemini_report_pass`
- `system_reconciled`
- `system_arbitrated`
- `user_confirmed`
- `user_corrected`

### 10.2 这条机制的本质

这是 Atlas 当前最容易被低估的卖点之一。

它意味着系统已经不是“一份 AI 输出”。
它是一条有状态迁移的工作流：

- AI 初次抽取
- AI 完整报告
- 系统合并
- 系统裁判
- 人工确认
- 人工修正

### 10.3 它解决了什么真实痛点

论坛里用户最怕的是：

- AI 结果看着像最终版
- 人工改了以后又和 AI 结果混在一起
- 导出后分不清哪些值被验证过

Atlas 这套状态机制，本质上是在做：

`把 AI first pass 和人工工作结论放到同一任务面里，但不让它们混成一层。`

### 10.4 对外怎么讲

- `Atlas 不把 AI 提取值和人工修正值混在一起。每个参数都知道自己现在处在哪个信任状态。`

## 11. reviewed export 是很硬的卖点，不要讲轻了

### 11.1 当前导出不是简单 dump

当前导出里已经保留：

- 参数状态中文标签
- evidence page / quote
- sourceAttribution
- follow-up transcript
- public notes
- report sections

并且 CSV、JSON、HTML 的表达是分层的。

### 11.2 为什么这件事很重要

很多 AI 工具最大的问题不是屏幕里错，而是：

`一导出就把所有信任上下文洗掉了。`

导出成一个干净表格以后，团队里的下游人只会看到“这个数字”，不会看到：

- 待确认
- 已人工修正
- 来自哪页
- 来自哪条运行路径

Atlas 当前导出机制，其实是在做：

`把 trust context 一起导出去。`

### 11.3 对外怎么讲

- `Atlas 的导出不是“把 AI 结果拷出去”，而是把证据、状态和人工修正一起带出去。`

## 12. runtime attribution 是少见但很实的信任机制

### 12.1 当前系统已经把运行路径暴露到工作面和导出里

现在可以看到：

- `provider/model`
- `pdf_direct` 还是 `image_fallback`
- `single` 还是 `staged`
- 部分状态下甚至能看到 `failed` / partial attribution

### 12.2 这解决什么

论坛里用户对“你到底怎么读的这份 PDF”非常敏感。

runtime attribution 给出的不是一句 marketing 解释，而是这次运行的具体路径。

这让系统从一个黑盒问题，变成一个可诊断问题：

- 这次是不是 PDF direct
- 这次是不是 fallback
- 这次是不是 staged
- 这次结果为什么比上一次更弱

### 12.3 对外怎么讲

- `Atlas 不只给结果，也告诉你这次结果是通过哪条分析路径跑出来的。`

## 13. grounded follow-up 不是“支持追问”，而是“限制追问”

### 13.1 当前 follow-up 不是自由聊天

测试和文档都明确说明：

- follow-up 只在 first-pass 结果存在后才开放
- follow-up answer 必须围绕 current report、parameter store 和 evidence
- 如果资料不覆盖，要明确说没覆盖

### 13.2 这条机制的价值

大多数产品会把追问当作能力扩张。

Atlas 这里真正有价值的地方反而是：

`追问不能脱离 grounding 边界。`

这正好回应论坛里的核心质疑：

- 聊天越聊越漂
- 回答越来越像“顺着说”

### 13.3 对外怎么讲

- `Atlas 允许继续追问，但追问不能把你带离当前 datasheet 的证据边界。`

## 14. dual-route 不是一句“我们也有 parser”

### 14.1 当前不是 parser-first，也不是纯 direct-to-llm

当前策略明确是：

- `direct-to-llm` 负责主阅读和主报告
- `parse-to-llm` 负责结构化增强、复杂页补强、证据元数据、参数候选

### 14.2 这条机制为什么值得讲

论坛里很多人把问题看成二选一：

- 要么全靠 LLM
- 要么全靠 parser

Atlas 当前做的不是选边站，而是承认两边各有短板：

- 纯 parser 容易被复杂 PDF 打爆
- 纯 LLM 容易失去结构化增强和证据补料

### 14.3 当前卖点状态

这条线架构上成立，但对用户可见性还不够。

所以现在更适合讲成：

- `Atlas 不是用单一路径硬读 PDF，而是把整文阅读和结构化补强分开处理。`

不要讲得太细，也不要吹成已经完美解决复杂 PDF。

## 15. 机制级卖点里，当前最该大声讲的 6 个

如果只选 6 个当前最能打的，不选最抽象的，应该是这 6 个：

1. `类目模板 + 标准字段约束`
   - 不是泛化总结，是按器件类型落工程字段

2. `RF 暗知识包`
   - 不是只靠模型猜 RF 语义

3. `冲突不抹平，双路参数可裁决`
   - fast / report 打架时，系统会显式处理

4. `参数状态和 provenance`
   - 每个参数知道自己来自哪里、处于什么信任状态

5. `reviewed export`
   - 导出去的不只是数值，还有证据和确认状态

6. `runtime attribution`
   - 用户看得到这次结果的分析路径

## 16. 当前最该补硬的 4 个机制点

### 16.1 参数条件绑定做成一等对象

现在方法论里有，prompt 里有。
但还应进一步在结果模型和 UI 里更显式。

### 16.2 variant / package / family scope 暴露

这是论坛里非常实际的痛点。
现在还没有被做成特别硬的用户可见对象。

### 16.3 PDF / parse 质量可见化

用户应该更清楚知道：

- 哪些页风险高
- 为什么当前结果 partial
- 哪些证据是近似定位

### 16.4 staged 模式的用户心智

现在机制有了，用户体验里还没完全讲清楚：

- “首批关键参数” 和 “完整报告” 的区别
- staged 不是普通 loading，而是信任分阶段交付

## 17. 一句话结论

如果要把当前 Atlas 的卖点讲尖，不该再讲：

- evidence-first
- trust loop
- better verification

这些词本身没错，但还不够抓手。

更该讲的是：

`Atlas 不是一个会聊天的 datasheet AI。它会先按器件类目套工程字段，注入领域阅读方法，分阶段出结果，快慢结果冲突时显式裁决，每个参数都带状态和来源，导出时把证据和人工修正一起带出去。`

这才是 generic chat 工具没有，而我们已经开始拥有的东西。

