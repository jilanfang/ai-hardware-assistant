# RF Overview

## 角色
RF 类器件的首要问题不是“这颗芯片有多少 dBm”，而是“它在射频链路里扮演什么角色”。
常见角色包括 PA、LNA、FEM、switch、transceiver、PLL/VCO/synthesizer。

## 阅读总原则
- 先确认频段、制式、链路位置。
- 再看线性输出、增益、NF、IIP3、隔离等系统级指标。
- 最后看控制、封装、layout、thermal 与实际落地约束。

## 不该直接塞进 keyParameters 的内容
- 纯工程建议
- 版图风险
- 热设计建议
- 兼容性担忧
- 待确认项
