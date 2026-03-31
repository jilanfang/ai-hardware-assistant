# Datasheet 双路线阅读策略实施设计

## 1. 文档目的

这份文档定义 `Pin2pin Atlas` 在 datasheet 场景下的下一阶段阅读策略：

- `direct-to-llm`
- `parse-to-llm`

两者不是二选一，而是增强关系：

- `direct-to-llm` 负责主阅读、主报告、主教学体验
- `parse-to-llm` 负责结构化增强、证据补强、复杂页修复、参数候选和回跳元数据

本文档不是模型选型文档，也不是提示词碎片备忘录。它是一份实施设计文档，目标是为后续产品、prompt、输出契约与工程实现提供统一源头。

## 2. 核心判断

### 2.1 为什么从 parser-first 调整为双路线

当前 parser-first 链路在以下场景下天然吃亏：

- 双栏排版
- 跨页表格
- 水印干扰
- 图表密集页
- 复杂章节跳转
- 依赖 footnote / test condition 的规格页

对用户来说，尤其是在“我想先知道这颗器件值不值得深读”的阶段，直接让大模型读 PDF 更接近主观预期。大模型更容易先建立器件定位、章节重点、阅读顺序和工程风险感知。

但 parse 路线并没有失效。它在以下场景仍然重要：

- 结构化参数表
- page / quote / bbox 证据
- 复杂页局部补强
- 可回跳的引用元数据
- 参数候选对齐

因此本产品在 datasheet 阅读上采用双路线增强关系，而不是路线替换。

### 2.2 默认原则

默认原则固定如下：

1. 默认先走 `direct-to-llm`
2. 若本地解析质量足够，则把 `parse-to-llm` 结果作为补充上下文喂给模型
3. parser 输出不再被视为主结论来源
4. 最终结论由 LLM 负责组织，但必须尽量保留 datasheet 事实边界
5. evidence-first 原则继续保留，只是主理解能力从 parser 转移到 LLM

## 3. 双路线定义

### 3.1 Direct-to-LLM

`direct-to-llm` 的职责：

- 直接阅读整份 datasheet PDF
- 判断器件身份、用途与类目
- 形成“怎么读这份 datasheet”的教学式报告
- 提炼关键参数、风险点、章节优先级
- 用资深硬件工程师口吻指导没有经验的实习生

`direct-to-llm` 是主阅读链路，因此优先承担：

- 首轮理解
- 首轮总结
- 教学式解释
- 实习生阅读建议
- 章节阅读顺序

### 3.2 Parse-to-LLM

`parse-to-llm` 的职责：

- 提供结构化参数候选
- 提供 page / quote / bbox 等证据元数据
- 为复杂页补充局部解析结果
- 在关键参数层面增强引用可信度
- 支持参数表、可回跳 citation 和后续导出

`parse-to-llm` 是增强链路，因此不负责：

- 主器件理解
- 主报告叙事
- 主方法论输出

### 3.3 两条路线的协作方式

默认协作方式如下：

1. 系统把原始 PDF 直接送入 `direct-to-llm`
2. 系统并行或顺序地产生 `parse-to-llm` 结构化结果
3. LLM 主报告以 `direct-to-llm` 阅读结论为骨架
4. `parse-to-llm` 结果作为以下补料进入主报告：
   - 参数候选
   - page references
   - quote snippets
   - 复杂页修复摘要
   - evidence jump metadata
5. 若两者冲突：
   - 优先保留 datasheet 原始页面语义
   - parser 结果只作为辅助，不单独覆盖主结论
6. 若 parser 质量差：
   - 系统继续给出 `direct-to-llm` 主报告
   - 只降低 citation 和结构化参数增强能力

## 4. 统一 datasheet 阅读方法论

这一部分不是附录，而是后续所有 prompt 的基础行为要求。

### 4.1 七步骨架

所有类目共用以下 7 步阅读骨架：

1. 先确认器件身份与用途
   - part number
   - manufacturer
   - device class
   - target application
2. 先读首页与 feature list
   - 先抓产品定位
   - 不先掉进长表和细节页
3. 区分 `Absolute Maximum Ratings` 与 `Recommended Operating Conditions`
   - 不把绝对极限当正常工作区间
4. 读 `Electrical Characteristics` 时连同 test condition 一起读
   - 没有条件的数字不能直接拿来比较
5. 识别真正影响选型的系统级关键参数
   - 不把“抄数字”当“完成理解”
6. 读 pin/package/layout/thermal/control interface
   - 找实际落地风险
7. 记录 open questions、未覆盖条件、typical 与 guaranteed 的区别

### 4.2 强制解释的误读点

每份报告都要强制检查以下误读点：

- `Absolute Maximum` 不是推荐工作条件
- `Typical` 不等于 `guaranteed`
- 同一个参数在不同 test condition 下不可直接横比
- 图表中的典型曲线不等于量产边界
- layout / thermal / matching / filter / control 配置会改变“看起来相同”的规格
- 封装、引脚复用、控制接口往往比首页卖点更影响落地

### 4.3 对实习生的默认教学目标

LLM 必须默认把读者当作缺少经验的实习生，因此输出时要解释：

- 先看哪一页，为什么
- 哪些数字是“先抓的大方向”
- 哪些表和图是“后面深读再看”
- 哪些词是行业黑话，需要解释
- 哪些条件如果没看懂，就不要轻易下结论

## 5. 方法论来源

后续方法论和 prompt 设计应参考以下公开资料，并在实际产品实施时允许继续补充：

- TI datasheet terms
  - [https://www.ti.com/lit/szza036](https://www.ti.com/lit/szza036)
- TI understanding test conditions
  - [https://e2e.ti.com/cfs-file/__key/telligent-evolution-components-attachments/00-151-01-00-01-06-09-56/understanding-datasheets.pdf](https://e2e.ti.com/cfs-file/__key/telligent-evolution-components-attachments/00-151-01-00-01-06-09-56/understanding-datasheets.pdf)
- ADI how to read a datasheet
  - [https://www.analog.com/en/resources/media-center/videos/5623613436001.html](https://www.analog.com/en/resources/media-center/videos/5623613436001.html)
- ADI wireless specification tutorial
  - [https://www.analog.com/en/resources/technical-articles/understand-wireless-data-sheet-specifications--part-1.html](https://www.analog.com/en/resources/technical-articles/understand-wireless-data-sheet-specifications--part-1.html)
- TI audio specs
  - [https://www.ti.com/video/6287830551001](https://www.ti.com/video/6287830551001)

这些来源的用途不是让系统逐句复述，而是抽象出：

- 读 datasheet 的顺序
- 理解 test condition 的习惯
- 识别典型误读点
- 面向不同器件类目的重点参数思维框架

## 6. Prompt 体系

Prompt 体系固定为三层：

- `base role prompt`
- `device-class template prompt`
- `task-specific prompt`

### 6.1 Base Role Prompt

这是所有 datasheet 阅读任务共享的主 system prompt。

#### 角色定义

你是一名资深硬件工程师，正在指导没有经验的实习生阅读 datasheet。  
你的目标不是复述 PDF，而是帮助实习生形成可执行的阅读顺序、参数理解和工程判断。  
你必须明确区分：

- datasheet 明示事实
- 基于工程经验的解释
- 待确认项或条件缺失项

#### 基础行为要求

模型必须：

- 先判断器件是什么、解决什么问题
- 告诉读者这份 datasheet 先看哪些章节
- 解释关键参数为什么关键
- 解释哪些 test condition / footnotes / graphs 容易误导新人
- 给出后续深读顺序
- 用教学风格组织输出，而不是做无差别摘要

#### 基础输出要求

模型默认必须覆盖：

- 这是什么器件
- 用在什么系统里
- 先看哪几章
- 核心参数和这些参数的工程意义
- 最容易踩坑的地方
- 如果让实习生继续读，下一步该怎么做

### 6.2 Device-Class Template Prompt

每个类目模板都必须定义：

- 最核心的参数维度
- 应优先看的章节
- 常见误读点
- 需要向新人解释的术语
- 最终报告的类目专属章节

#### `rf-general`

覆盖：

- LNA
- PA
- FEM
- switch
- filter
- front-end

重点参数维度：

- frequency range
- gain / insertion loss
- output power
- linearity
- noise figure
- harmonics / ACPR / EVM
- matching / control interface
- package / layout constraints

优先章节：

- feature list
- functional block diagram
- electrical characteristics
- RF performance tables
- graphs
- application / layout

常见误读点：

- 把不同 band / mode 下的参数直接横比
- 把 graph 里的典型曲线当量产承诺
- 忽略 matching、bias、control state 对性能的影响

#### `audio`

覆盖：

- amplifier
- codec
- ADC/DAC
- audio switch / interface

重点参数维度：

- supply voltage
- output power / load
- THD+N
- SNR / dynamic range
- PSRR
- gain setting
- channel configuration
- thermal / pop-click / protection

优先章节：

- overview / feature list
- recommended operating conditions
- electrical characteristics
- application information
- thermal / package

常见误读点：

- 不看负载条件就比较输出能力
- 不看带宽和测试频率就比较 THD+N
- 忽略静态功耗、热和保护触发条件

#### `cellular-3g4g5g`

覆盖：

- cellular PAM
- transceiver
- RF front-end
- tuner / module

重点参数维度：

- supported bands / modes
- linear output power
- efficiency
- ACLR / EVM / harmonics
- control interface
- envelope tracking / APT
- MIPI RFFE
- package / thermal

优先章节：

- feature list
- supported band tables
- electrical characteristics
- RF performance tables
- control interface
- ordering / package / layout

常见误读点：

- 不区分 NR/LTE/WCDMA 不同 mode 的测试条件
- 不区分 band-specific performance
- 忽略控制接口和时序带来的系统集成门槛

#### `wifi`

覆盖：

- Wi-Fi FEM
- module
- RF combo front-end

重点参数维度：

- frequency bands
- Tx gain / Rx gain
- output power
- receive path loss / NF
- coexistence
- control logic
- package / layout

优先章节：

- feature list
- RF characteristics
- functional description
- application / layout

常见误读点：

- 不分 2.4 GHz / 5 GHz / 6 GHz
- 忽略外部控制脚和系统状态切换
- 不看 layout recommendation 就判断可替换性

#### `power`

覆盖：

- DC-DC
- LDO
- PMIC
- charger / regulator

重点参数维度：

- input voltage
- output voltage / current
- efficiency
- switching frequency
- dropout
- transient response
- quiescent current
- protection
- thermal / package

优先章节：

- feature list
- absolute max
- recommended operating conditions
- electrical characteristics
- application / compensation / layout

常见误读点：

- 把 startup / transient / thermal 忽略掉
- 只看输出电流，不看条件和散热前提
- 不看外围器件和 layout 限制

#### `generic-fallback`

用于：

- 未进入 v1 正式模板的器件

固定要求：

- 先解释器件身份与应用
- 给出最小阅读顺序
- 列出最重要的 5-8 个系统级参数
- 标记待确认项
- 避免伪装成专业模板

### 6.3 Task-Specific Prompt

这一层只负责注入任务上下文，不重复定义系统角色。

固定输入项：

- 当前 PDF
- 用户目标
- 输出语言
- 是否需要教学风格
- 是否需要参数表
- 是否需要风险表
- 是否需要实习生阅读建议

固定原则：

- task prompt 只注入任务变量
- 不改写 base role 的身份
- 不覆盖类目模板中的重点参数与误读点

## 7. 报告输出契约

最终输出固定为“教学式工程报告”，不是普通 summary。

### 7.1 v1 输出字段

- `device_identity`
- `what_this_part_is_for`
- `how_to_read_this_datasheet`
- `key_parameters`
- `section_by_section_reading_order`
- `critical_graphs_and_tables`
- `risks_and_gotchas`
- `intern_action_list`
- `open_questions`
- `glossary_for_juniors`

其中以下字段不可省略：

- `how_to_read_this_datasheet`
- `intern_action_list`

### 7.2 字段定义

#### `device_identity`

必须说明：

- part number
- manufacturer
- device class
- target application

#### `what_this_part_is_for`

用实习生能理解的语言解释：

- 这个器件在系统里扮演什么角色
- 为什么有人会选它
- 它不是做什么的

#### `how_to_read_this_datasheet`

必须告诉读者：

- 先读哪些章节
- 每一章要解决什么问题
- 哪些章节适合先跳过

#### `key_parameters`

必须分成三类：

- 必看参数
- 次级参数
- 依赖 test condition 的参数

每个参数至少说明：

- 参数名
- 代表什么
- 为什么重要
- 阅读时要连同哪些条件一起看

#### `section_by_section_reading_order`

必须给出实操顺序，例如：

1. 首页 / feature list
2. block diagram
3. recommended operating conditions
4. electrical characteristics
5. graphs / performance tables
6. layout / package / interface

#### `critical_graphs_and_tables`

不是罗列所有图表，而是指出：

- 哪些图表必须读
- 每张图 / 每张表要观察什么
- 哪些图表最容易误导新人

#### `risks_and_gotchas`

必须强制覆盖：

- absolute max vs recommended
- typical vs min/max
- test condition hidden dependency
- layout / package / thermal risk
- interface / control / configuration dependency

#### `intern_action_list`

必须把后续动作拆成可以执行的清单，例如：

- 先核对 band coverage
- 再核对 test condition 下的 output power
- 再看 package / layout 是否满足项目限制

#### `open_questions`

记录：

- datasheet 未明确回答的问题
- 当前 PDF 还不能直接下结论的地方
- 需要补看 app note / layout guide / family manual 的点

#### `glossary_for_juniors`

解释：

- 类目黑话
- 常见缩写
- 关键测试术语

### 7.3 Parse-to-LLM 增强字段

当 parse 路线存在时，报告可以附加：

- 结构化参数表
- citation / page references
- evidence jump metadata

这些增强字段的职责是补强验证，不是取代主报告。

## 8. 类目范围与遗漏项

### 8.1 v1 正式支持类目

v1 只正式支持：

- `rf-general`
- `audio`
- `cellular-3g4g5g`
- `wifi`
- `power`
- `generic-fallback`

### 8.2 RF 与 cellular / wifi 的关系

文档里必须明确：

- `RF` 是更广义射频模板
- `cellular-3g4g5g` 和 `wifi` 是通信子模板

其中：

- `RF` 强调 LNA、PA、FEM、switch、filter、front-end 的通用射频阅读思路
- `cellular-3g4g5g` 强调 band / linearity / power / mode / protocol / control
- `wifi` 强调 frequency band、gain、front-end integration、control 和 layout

### 8.3 当前遗漏但不进入 v1 的未来候选

建议列入未来候选，但不在 v1 细分：

- MCU / processor / SoC
- sensor
- interface / clocking / high-speed link
- memory / storage
- analog signal chain

默认策略固定如下：

- 以上未覆盖器件统一走 `generic-fallback`
- 不在 v1 继续细分，避免模板爆炸

## 9. 产品与实现含义

### 9.1 对产品的含义

产品主结果不再只是：

- summary
- review
- key parameters

而应升级为：

- 教学式工程报告
- 实习生阅读顺序
- 类目化关键参数
- 风险与误读点

### 9.2 对实现的含义

后续实现应按以下顺序推进：

1. 定义 `base role prompt`
2. 定义 6 个 device-class prompt 模板
3. 定义 task-specific prompt contract
4. 定义教学式报告输出 schema
5. 把 `direct-to-llm` 设为默认主阅读链路
6. 把 `parse-to-llm` 接成增强输入与 evidence 层

## 10. 文档验收清单

文档验收必须检查：

- 是否明确写清双路线关系，而不是二选一
- 是否把 `direct-to-llm` 设为主阅读链路
- 是否把 `parse-to-llm` 定义为增强层而非主结论层
- 是否有统一 datasheet 阅读方法论，而不是只堆 prompt
- 是否有类目模板和每类关键参数维度
- 是否有“资深硬件工程师带教实习生”的固定角色 prompt
- 是否有教学式报告输出契约
- 是否明确列出典型误读点与风险项
- 是否标注了 v1 覆盖类目和未来遗漏类目
- 是否附了外部依据来源或链接位

## 11. 后续实施验证场景

若进入实施规划，首批验证样本应覆盖：

- RF / PA / FEM 类 datasheet
- Audio amplifier / codec 类 datasheet
- Cellular PAM / transceiver 类 datasheet
- Wi-Fi FEM / module 类 datasheet
- Power 类 datasheet
  - DC-DC
  - LDO
  - PMIC 子集
- 一个 `generic-fallback` 样本

## 12. 本文档的固定默认项

- 本文档是实施设计文档，不是策略备忘录。
- 默认关系是增强关系：
  - `direct-to-llm` 负责主阅读
  - `parse-to-llm` 负责增强与证据补强
- 本文档不在这一版决定具体模型供应商。
- 本文档保留 evidence-first 原则，但承认主理解能力来自 LLM。
- v1 正式支持类目固定为：
  - RF
  - Audio
  - 3G/4G/5G
  - Wi-Fi
  - Power
  - Generic fallback
- 未来候选类目只列入本文档，不在这版继续展开。
