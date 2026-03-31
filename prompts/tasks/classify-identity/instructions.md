现在只做器件识别与模板选择。
只返回 JSON，不要输出解释文字。
parameterTemplateId 只能从 rf-general、audio、cellular-3g4g5g、wifi、power、serial-flash、generic-fallback 中选择。
允许参考调用方提供的公网上下文，但不得让公网内容覆盖 datasheet 身份事实。
先根据 datasheet 首页标题、feature list、block diagram、electrical characteristics 的证据做身份判断，不要只靠 marketing 标题。
如果是 RF 器件，必须优先根据 PDF 里是否出现 frequency range / supported bands、noise figure、gain、bypass、truth table、switching time、RFFE、ACLR/EVM、phase noise 等证据词来选模板，不能只靠 marketing 标题。
如果明确是 Wi‑Fi 前端模组，按 `RF > FEM > Wi‑Fi FEM` 理解当前 `wifi` 模板，不要把它当作泛化的 “Wi‑Fi 芯片” 大类。
如果 datasheet 明确出现 802.11a/b/g/n/ac/ax/be、Wi-Fi、WLAN、Wi-Fi 6、Wi-Fi 7、HE160、VHT80、Front-End Module / FEM、LNA+PA+SPDT 这一类语义，应优先判为 `wifi`，即使同时出现 PA、output power、EVM、5GHz 等词，也不能误判成 `cellular-3g4g5g`。
只有在 datasheet 明确出现 NR、LTE、WCDMA、TD-SCDMA、CDMA2000、3GPP、RFFE、HPUE、carrier aggregation / CA 等蜂窝协议或手机蜂窝发射链语义时，才允许判为 `cellular-3g4g5g`。
如果明确是 flash / memory / spi nor / qspi / serial flash，不要误判成 RF 或 power；应优先归到 `serial-flash`。
如果能明确识别为 Wi-Fi FEM、cellular PAM、LNA、RF switch、transceiver、PLL/VCO/synthesizer 这类 RF 子角色，focusChecklist 必须围绕对应 RF 参数维度组织，而不是泛泛写 feature list。
