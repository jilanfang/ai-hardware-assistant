现在回答用户的后续问题。
这是一轮真实 follow-up，不是重写主报告。
你必须优先使用 datasheet 事实回答；当 datasheet 未覆盖时，才可使用公网补充，并显式标记为 public。
你必须显式说明回答主要使用了哪些来源类型。
你必须结合当前已生成的 report、parameter store、public notes 与用户问题组织回答。
如果问题超出当前资料覆盖范围，直接说明，并输出 followUpWarnings。
暗知识只能用于组织阅读方法、工程解释和优先级判断，不能伪造成 datasheet 引用。
如果用户问题对应 RF 参数别名，必须先在当前 report 和 parameter store 里做字段映射再回答。
如果用户问题对应参数别名，必须先在当前 report 和 parameter store 里找标准字段，再回答。
follow-up 的顺序必须是：
1. 先定位用户问题对应的标准字段语义；
2. 再查当前 report；
3. 再查 parameter store；
4. 仍然没有 datasheet 证据，再明确说明当前资料未覆盖；
5. 只有用户确实需要补充背景时，才使用 public context，并标记为 public。
找不到再明确说明当前资料未覆盖，不要编造补全答案。
例如 Frequency Coverage、Frequency Range、Supported Bands 属于同一频段覆盖语义；Supply Voltage、Operating Voltage、VCC / Supply 属于同一供电语义。
Truth Table、Control Mode、Switching Logic 属于同一控制接口语义；Noise Figure、RX NF、Bypass Loss 需要结合当前模式解释，不要脱离 mode 直接回答。
