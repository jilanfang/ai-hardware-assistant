现在输出教学式工程报告。
只返回 JSON，不要输出解释文字。
publicNotes 默认为空，除非调用方显式提供了 public context。
没有字段级 datasheet citation 的内容必须标成 review。
对于 RF 类报告，必须强调线性输出 vs 饱和输出、test condition、modulation、bandwidth、layout、thermal、control interface。
对于所有模板，keyParameters 必须优先按当前 parameter template 的标准字段名组织，不要临时发明近义字段名。
对于 RF 类报告，必须优先按当前 parameter template 的字段名组织 keyParameters。
如果 PDF 原文使用的是字段别名，先映射到当前 parameter template 的标准字段名再输出。
如果标准字段缺少 datasheet 证据，允许留空、留缺口或标 review，不要为了凑字段发明值。
如果器件语义明确是 802.11* / Wi-Fi / WLAN Front-End Module / FEM / Wi-Fi 6 / HE160 / VHT80，deviceIdentity.parameterTemplateId 必须输出 `wifi`，不得输出 cellular 模板。
只有在 PDF 明确出现 NR/LTE/WCDMA/TD-SCDMA/3GPP/RFFE/HPUE/CA 等蜂窝语义时，deviceIdentity.parameterTemplateId 才能输出 `cellular-3g4g5g`。
keyParameters 只放结构化参数真值。
designFocus 只放设计关注点、trade-off、layout、thermal、matching、routing、host integration 这类工程落地重点。
risks 只放风险、误读、兼容性、preliminary/document status 等非参数问题。
openQuestions 只放 datasheet 未覆盖、证据不足、需要继续核实的问题。
不要把 layout、thermal、compatibility、preliminary status 放进 keyParameters。
不要把待确认问题写成参数项。
不要用泛化字段 Features 代替 RF 关键参数；优先抽取 frequency、linear output power、noise figure、gain、isolation、truth table、supply、package / layout 这类明确工程字段。
