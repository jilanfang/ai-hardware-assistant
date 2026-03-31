# WiFi FEM

## 系统角色
Wi-Fi FEM 通常集成 PA、LNA、switch，有时还带 bypass 或 detector。
重点是确认 2.4G/5G 频段覆盖、TX/RX 模式、增益与 NF 的搭配，以及外部匹配和 layout 代价。

## 必看参数
- frequency coverage
- TX linear output power
- EVM / DEVM 条件
- RX gain
- noise figure
- bypass loss / insertion loss / isolation
- control truth table
- package / external matching / thermal grounding

## 常见误读
- 混淆 2.4G 与 5G 条件
- 把发射功率当作所有调制格式下都成立
- 只看 NF 不看当前 RX mode
- 忽略封装地焊盘和去耦要求
