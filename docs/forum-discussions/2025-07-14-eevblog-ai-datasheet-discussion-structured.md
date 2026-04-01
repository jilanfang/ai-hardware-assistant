# EEVblog 讨论结构化存档

## 讨论元信息
- Topic: `Is there any AI that can actually read through datasheets?`
- Forum: EEVblog
- 讨论起点发言时间: `2025-07-14 09:25:25 pm`
- 当前归档覆盖范围: `Reply #0` 到 `Reply #62`
- 归档目标: 将讨论内容按发言主题、立场分布、争点、案例和任务场景进行结构化整理
- 归档约束: 不加入归档者判断、不补充外部事实、不做结论

## 发起问题
- 发起人 `Pkoff123` 提出的问题是：现有 AI 是否能真正读取 datasheet。
- 发起动机包括：
  - 认为现有 ChatGPT 会频繁 hallucinate。
  - 认为它会给出假的页码和假的引文。
  - 希望如果该能力可靠，工程效率可以显著提升。
- 在后续追问中，发起人又补充了两个关键信息：
  - 已经尝试上传 datasheet PDF。
  - 已经尝试更高价版本和“deep research”类选项，但仍认为经常出错。

## 主要参与者与对应表达方向

### 1. 强烈否定类
- `tggzzz`
- `moffy`
- `Ian.M`
- `UnijunctionTransistor`
- `Buriedcode` 在单文档查询场景下偏向此方向

### 2. 条件可用类
- `wraper`
- `ejeffrey`
- `meshtron`
- `sleemanj`
- `Zero999`

### 3. 场景区分类
- `Kleinstein`
- `tszaboo`
- `Siwastaja`
- `HwAoRrDk`

### 4. 技术机制解释类
- `Smokey`
- `BadeBhaiya`
- `meshtron`
- `HwAoRrDk`
- `TimFox`

## 观点簇 A：LLM 不能被视为可靠 datasheet 阅读工具

### 代表性表达
- `tggzzz` 明确表示没有任何 AI 能做到可靠读取 datasheet。
- 多位参与者将 LLM 描述为生成统计上可能连在一起的话，而不是理解技术文档。
- 这一簇发言反复提到 hallucination、假参数、假链接、假引用、看似合理但内容错误。

### 相关展开
- `moffy` 认为 LLM 的内部结构复杂且不可解释，会在一段时间内连贯，然后开始输出 nonsense。
- `Ian.M` 将概率关联与完整训练数据做区分，反对把模型当作“压缩后的知识库”。
- `UnijunctionTransistor` 用 `garbage in, garbage out` 概括风险。
- `tggzzz` 进一步延伸到 `LLM slop in, LLM slop out`，把网络内容质量也纳入问题来源。

## 观点簇 B：如果不读取当前 datasheet，就更容易胡说

### 代表性表达
- `wraper` 反复强调，模型若不读取真实 datasheet，而只是从模型里“猜”，就会有显著概率输出错误。
- `ejeffrey` 将“直接问聊天机器人”与“上传 PDF 后问答”区分开来，认为后者表现更好一些。

### 相关展开
- `wraper` 提出具体使用方式：
  - 上传 datasheet。
  - 或让 AI 在线检索到真实 datasheet。
- 这一簇观点不否认 hallucination，但把“是否接触原始文档”作为重要前提。

## 观点簇 C：问题不只在模型，也在 PDF 与文档摄取过程

### 代表性表达
- `BadeBhaiya` 认为长文本、上下文窗口限制、图像处理成本和多模态处理负担，会导致平台只处理部分内容。
- `meshtron` 将问题拆成两个大项：
  - PDF 到原始文本的转换质量。
  - LLM 的 context window 与多轮对话退化。
- `HwAoRrDk` 进一步指出 PDF 本身主要描述页面布局，不天然表达“表格”“语义结构”等信息。

### 相关展开
- `meshtron` 认为 datasheet 中的图片、表格、图表、混合布局会让 ingest 质量下降。
- `HwAoRrDk` 说明：
  - PDF 中文本位置和页面显示位置并不必然对应。
  - 表格在 PDF 中只是“把字画在这里、画线在那里”的结果。
  - 语义结构需要额外推断。
- `temperance` 提供了一个版面层面的案例：某份 datasheet 中有白底白字。

## 观点簇 D：任务值不值得交给 AI，要看场景

### 1. 单个 datasheet、单个参数查询
- `Buriedcode` 质疑这种场景下为什么需要 AI，认为 datasheet 本来就是供人检索的参考文档。
- `ejeffrey` 表示，很多时候 AI 只是比 `Ctrl-F` 快几秒。
- 这类发言共同强调：单文档、明确参数、可搜索时，AI 未必更高效。

### 2. 多份 datasheet、预筛选、结构化提取
- `Kleinstein` 提出大规模扫 datasheet 建数据库的用途。
- `tszaboo` 提出可以上传几十份 datasheet，让系统整理 vendor-specific 叙述，输出更结构化的信息。
- `Siwastaja` 认为当数据量大、格式差异大、且目标是 preselection 时，AI 辅助是有意义的。

### 3. 人工阅读的附带收益
- `Siwastaja` 提到，大量手动浏览 datasheet 会帮助工程师形成对市场和器件类别的整体把握。

## 观点簇 E：现有参数搜索工具与 AI 之间的比较

### 1. 参数搜索工具更可控
- `tggzzz` 认为 DigiKey、Mouser 等参数搜索虽不完美，但用户能看见它们错在哪里。
- 他将这一点与 LLM 的隐蔽错误做区分。

### 2. 参数搜索工具本身也很差
- `Siwastaja` 反对把现有 parametric search 视为更优方案。
- 他指出的问题包括：
  - 错误数据很多。
  - 分类字段设计不合理。
  - 关键参数可能根本没有列出。
  - 参数可能被混入庞大组合字段，难以直接筛选。

### 3. 中间用法
- 在若干发言中，AI 与 parametric search 都被放在“第一轮缩小范围”的位置。
- 后续人工核对原始 datasheet 被多位参与者默认视为仍然需要。

## 观点簇 F：提示词、模型、产品形态会显著影响结果

### 1. 提示词因素
- `sleemanj` 明确提出“问什么、怎么问”很关键。
- `tggzzz` 补充，多轮追问和纠错提示也会影响输出。

### 2. 模型差异
- `wraper` 提到 `Grok 4`。
- `sleemanj` 用 `Gemini` 复测某器件推荐任务，称结果较好。
- `HwAoRrDk` 用 `Copilot` 和 `Gemini` 做过对比测试，认为两者都存在明显遗漏或误读。
- `meshtron` 提到 `o3-pro` 在其使用场景中给出过较强回答，但更贵、更慢。

### 3. 产品交互形态
- `tszaboo` 提出，相比一次性的聊天界面，更理想的是可保留资料、可重复分析的 workspace。

## 技术解释线 1：模型与训练数据的关系

### `Smokey` 的说法
- 模型在某种意义上像训练数据的 lossy compression。

### `wraper` 的说法
- 训练过不等于原始 datasheet 数据本体存在于模型里。

### `tggzzz` 的说法
- 严格说原始片段不直接存在，但影响以权重形式保留。

### `Ian.M` 的说法
- 反对将关联概率结构直接视为完整训练内容的压缩表示。

## 技术解释线 2：上下文窗口与对话长度
- `BadeBhaiya` 认为长 datasheet 文本和图像内容会迅速消耗上下文。
- `meshtron` 说明多轮对话时，每次请求都要重新 ingest 既有上下文，导致有效可用窗口逐渐变小。
- 这条线的讨论将“长 PDF 一上传就容易表现变差”作为常见现象。

## 技术解释线 3：表格、图像、脚注和条件说明
- `Kleinstein` 提到，很多关键信息在表格里，不是普通自然语言段落。
- `tggzzz` 强调，关键不只是“一个数字”，还有数字成立的条件。
- `TimFox` 在 OP27 例子里指出，真实电路中的 output offset voltage 与 noise gain 相关，而不是简单等于 closed-loop gain 乘 input offset voltage。
- 这一线讨论强调：
  - 同一参数在不同变体、不同条件、不同封装下可能变化。
  - 光抽出“魔法数字”不足以完整表达 datasheet 信息。

## 经验案例汇总

### 案例 1：Google / AI 直接问答参数
- `Zero999` 询问了 `NE555`、`LM358`、`TL072` 的几个参数。
- 其观察是：
  - 某些回答表面上较像正确答案。
  - 但在 `TL072` 案例中，模型把不同变体的参数混在一起。

### 案例 2：GitHub Copilot 推荐 buck regulator
- `HwAoRrDk` 给出较完整的失败案例。
- 描述中的问题包括：
  - 部分 TI 器件不满足 0.8V Vref 要求。
  - 某些 Richtek 器件 pinout 不兼容。
  - 某个器件不存在。
  - 某个器件封装不对且已 NRND。
  - 在进一步追问后，仍遗漏多家厂商的符合条件器件。
  - 对 datasheet pin table 的解读也出现错误。

### 案例 3：Gemini 对同类器件筛选任务的表现
- `sleemanj` 表示 Gemini 给出的推荐在其检查下都确实具有 0.8V reference。
- `HwAoRrDk` 随后复测表示：
  - 初始建议比 Copilot 好一些。
  - 但仍漏掉许多符合条件的器件。
  - 后续扩展到更多厂家后再次出现封装不符、pinout 不符、链接异常和误读 pin table 的情况。

### 案例 4：OP27 输出偏移电压问答
- `Conrad Hoffman` 展示了 Copilot 对 `OP-27` 的回答全文。
- 回答内容涉及：
  - 输入失调电压分档。
  - 闭环情况下输出偏移与增益关系。
  - 温漂与调零。
- `TimFox` 指出其中关于 output offset voltage 的表述在真实电路里并不充分，应该关注 noise gain。
- `meshtron` 又补问了 noise gain，并更新了共享链接。

### 案例 5：o3-pro 读取 datasheet 的体验
- `meshtron` 表示自己看到 `o3-pro` 在回答时主动拉取 datasheet。
- 他把该例子作为“较强模型在部分任务上可用”的补充数据点。

## 与“训练专业模型”相关的讨论

### 支持方向
- `Smokey` 提出若模型主要训练在 datasheet 上，理论上效果会更好。
- `Analog Kid` 进一步提出是否可以做只基于可靠技术资料训练的模型。
- `meshtron` 则设想未来芯片厂商可能提供基于自家产品训练的小模型。

### 保留与质疑
- `tggzzz` 没有把“清理训练集”视为足以解决问题的办法。
- 在 Grok 相关插曲中，相关讨论被拉到“训练源可靠性”和“模型根本工作方式”上。

## 与“厂家提供机器可读数据”相关的讨论

### 支持机器可读输出
- `Kleinstein` 认为从厂家直接获取 machine-readable data 会更好。
- `Siwastaja` 提出，不一定非要统一标准，只要能把表格数据导出来就有价值。
- `Alex Eisenhut` 补充了 footprint 尺寸等细节数据也常有类似问题。

### 对此方向的限制性补充
- `tggzzz` 提醒，很多规格的有效条件很复杂，未必容易压缩为简单标准字段。
- `Siwastaja` 的回应是，即便只是导出 PDF 中已有的 tabulated data，也能降低大量人工分类和图形解析成本。

## 争点清单

### 争点 1
- LLM 失败的主因到底是：
  - 模型本质，
  - 还是没有读取当前原始 datasheet，
  - 还是 PDF / OCR / layout parsing 问题，
  - 还是上下文窗口不足。

### 争点 2
- 对于 datasheet 任务，AI 的适用位置到底是：
  - 单文档精确问答，
  - 还是多文档预筛选与结构化整理。

### 争点 3
- 现有 parametric search 与 AI 相比，谁更适合作为第一轮筛选工具。

### 争点 4
- 通过更专业的数据集或更专业的小模型，是否能显著改善表现。

### 争点 5
- 更理想的改进方向应该是：
  - 更强的 LLM，
  - 更强的 PDF ingest，
  - 更长上下文，
  - 更好的 workspace 形态，
  - 还是厂家直接提供机器可读参数。

## 按任务类型拆分的讨论内容

### 任务类型 A：问单个器件的单个参数
- 常见示例：
  - `NE555` 最大电压
  - `LM358` offset voltage
  - `TL072` 输入噪声
  - `OP27` output offset voltage
- 相关发言主要围绕准确率、脚注、变体和条件限制展开。

### 任务类型 B：按约束条件选芯片
- 常见示例：
  - 同步 buck、SOT23-6、0.8V Vref、指定 pinout 的器件推荐
  - 寻找满足 pulse-by-pulse current limit 且特定故障行为的 converter
- 相关发言主要围绕：
  - 是否能覆盖足够多厂商，
  - 是否会漏掉合格器件，
  - 是否会误判 pinout、封装、供货状态等。

### 任务类型 C：大规模预筛选与数据库化
- 常见示例：
  - 扫描大量 datasheet 构建结构化数据库
  - 提取 offset voltage、maximum supply voltage 等字段到 spreadsheet
- 相关发言主要围绕：
  - 是否值得容忍一定错误率，
  - 是否可与人工复核配合，
  - 是否优于人工维护的 parametric 数据库。

## 线程演化轨迹

### 阶段 1：题主抱怨与基本立场对撞
- 题主提出“为什么 AI 连这个简单事情都做不好”。
- 初期迅速出现两种对立回应：
  - `没有 AI 能做`
  - `如果它真的读了 datasheet 就可以做一些`

### 阶段 2：技术原理解释
- 讨论开始转向 LLM 的训练方式、内部表示、是否真的包含 datasheet 信息。
- 同时出现关于 context window、PDF 结构和多模态处理负担的说明。

### 阶段 3：场景转移到器件筛选和批量处理
- 讨论不再只停留在“能不能读一份 datasheet”，而是转向：
  - 是否能做器件推荐，
  - 是否能处理大量 datasheet，
  - 是否能替代现有 parametric search。

### 阶段 4：案例驱动的再次分化
- 多位参与者给出具体产品和模型的试验结果。
- 这些案例没有让讨论收敛，反而把争点进一步细化到：
  - 不同模型差异，
  - 不同 prompt，
  - 不同任务复杂度，
  - 不同验证标准。

### 阶段 5：延伸到未来方向
- 后段讨论开始从“今天能不能用”延伸到：
  - 更好的 ingest，
  - 厂家侧结构化输出，
  - 厂商专用模型，
  - 更可持续的 workspace / search 形态。

## 参与者提出的潜在产品形态
- 可上传多份 datasheet、重复运行分析的 workspace。
- 比当前 distributor parametric search 更灵活的新型搜索引擎。
- 芯片厂商基于自家产品线训练并开放的小模型。
- 厂家直接提供 CSV 或至少可抽取的 tabulated data。

## 原始讨论中的高频关键词
- hallucinate
- datasheet
- PDF
- context window
- tables
- images
- pinout
- variant
- parametric search
- preselection
- machine-readable
- original source
- Ctrl-F

## 归档用途建议字段
- 可用于后续做“观点比较”。
- 可用于后续做“争点拆解”。
- 可用于后续做“产品需求映射”。
- 可用于后续做“论坛原声摘录整理”。

