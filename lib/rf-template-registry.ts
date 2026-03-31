export type RfTemplateDefinition = {
  id: string;
  title: string;
  aliases: string[];
  mustExtractFields: string[];
  mustExtractAliases: string[];
  mustReviewTopics: string[];
  mustReviewAliases: string[];
  misreadTraps: string[];
  readingOrder: string[];
  promptAugment: string[];
};

const rfTemplateDefinitions: Record<string, RfTemplateDefinition> = {
  "rf-general": {
    id: "rf-general",
    title: "RF 母模板",
    aliases: ["rf", "front-end", "front end module"],
    mustExtractFields: [
      "device role in RF chain",
      "frequency range / supported bands",
      "linear output power",
      "gain / insertion loss / bypass loss",
      "noise figure / IIP3 / OIP3 / isolation",
      "control interface / truth table / switching time",
      "package / thermal / layout"
    ],
    mustExtractAliases: ["frequency", "bands", "linear power", "gain", "noise figure", "iip3", "oip3", "isolation", "truth table", "package"],
    mustReviewTopics: [
      "linear output vs saturated output",
      "test condition / modulation / bandwidth dependency",
      "control mode mapping",
      "layout grounding and thermal path"
    ],
    mustReviewAliases: ["thermal", "layout", "grounding", "test condition", "modulation", "bandwidth dependency"],
    misreadTraps: [
      "不要把饱和输出功率当作线性输出功率",
      "不要把 typical 当作 guaranteed",
      "不要脱离 mode 上下文去看 gain / NF / IIP3"
    ],
    readingOrder: [
      "feature list",
      "block diagram",
      "electrical characteristics",
      "truth table / timing",
      "package / layout"
    ],
    promptAugment: [
      "先确认器件在链路中的角色，再判断要看 PA、LNA、switch、mixer 还是 transceiver 指标。",
      "没有 mode、band、bandwidth、modulation 上下文的 RF 数字不要直接当结论。"
    ]
  },
  "wifi-fem": {
    id: "wifi-fem",
    title: "Wi-Fi FEM",
    aliases: ["wifi fem", "wlan fem", "front end module", "802.11ax fem", "802.11be fem"],
    mustExtractFields: [
      "frequency coverage",
      "tx linear output power",
      "evm condition",
      "rx gain",
      "noise figure",
      "bypass loss",
      "control mode / truth table",
      "power detector / coupler",
      "supply voltage",
      "package"
    ],
    mustExtractAliases: [
      "frequency coverage",
      "2.4g",
      "5g",
      "tx linear output power",
      "evm",
      "rx gain",
      "noise figure",
      "bypass loss",
      "truth table",
      "power detector",
      "supply voltage",
      "package"
    ],
    mustReviewTopics: [
      "2.4G vs 5G conditions",
      "MCS / bandwidth / EVM linkage",
      "TX / RX / bypass path switching",
      "layout, matching, decoupling and thermal guidance"
    ],
    mustReviewAliases: ["layout", "matching", "decoupling", "thermal", "switching", "mcs", "bandwidth linkage"],
    misreadTraps: [
      "不要把最大输出功率当作满足 EVM 条件的线性输出功率",
      "不要忽略 RX gain mode 与 bypass mode 的差异",
      "不要把 NF 和 RX gain 分开看而忽略同一模式条件"
    ],
    readingOrder: [
      "cover page / feature list",
      "block diagram",
      "RF performance table",
      "truth table / timing",
      "application circuit / layout"
    ],
    promptAugment: [
      "必须把 EVM 与 MCS、bandwidth、modulation 一起解释。",
      "必须区分 2.4GHz 和 5GHz 条件，不允许混写。",
      "如果 datasheet 明确出现 802.11ax、Wi-Fi 6、WLAN、HE160、VHT80、Front-End Module (FEM) 这一类语义，必须归到 wifi，不能归到 cellular。",
      "cellular 只有在明确出现 NR/LTE/WCDMA/TD-SCDMA/3GPP/RFFE/HPUE/CA 等蜂窝语义时才成立。"
    ]
  },
  "cellular-pam": {
    id: "cellular-pam",
    title: "Cellular PAM",
    aliases: ["cellular pam", "nr pam", "lte pam", "mmmb pam", "multimode multiband pam"],
    mustExtractFields: [
      "supported bands",
      "mode coverage",
      "bandwidth capability",
      "maximum linear output power",
      "aclr / evm condition",
      "rffe / mipi version",
      "current consumption",
      "vcc / supply",
      "package"
    ],
    mustExtractAliases: [
      "supported bands",
      "band support",
      "mode coverage",
      "bandwidth capability",
      "100mhz",
      "maximum linear output power",
      "max linear power",
      "linear output power",
      "hpue capability",
      "aclr",
      "evm",
      "rffe",
      "mipi version",
      "mipi 2.1",
      "current consumption",
      "vcc",
      "supply",
      "package"
    ],
    mustReviewTopics: [
      "band / mode / bandwidth dependency",
      "HPUE or high-bandwidth thermal cost",
      "APT / ET supply strategy",
      "RFFE truth table and host compatibility",
      "port mapping and RF routing",
      "preliminary document status"
    ],
    mustReviewAliases: [
      "thermal",
      "heat",
      "layout",
      "density",
      "port mapping",
      "routing",
      "apt power",
      "dc-dc",
      "document status",
      "preliminary",
      "compatibility",
      "integrity",
      "isolation"
    ],
    misreadTraps: [
      "不要只看最大 dBm，必须同时看 ACLR / EVM 条件",
      "不要忽略不同 band、mode、bandwidth 对线性功率的影响",
      "不要忽略 RFFE / MIPI 版本与主控兼容性"
    ],
    readingOrder: [
      "feature list",
      "band support table",
      "electrical characteristics",
      "RFFE control / truth table",
      "package / layout / thermal"
    ],
    promptAugment: [
      "keyParameters 必须优先给出 band、bandwidth、linear power、ACLR/EVM、RFFE、current、VCC、package。",
      "热设计、接口兼容、布局密度属于风险或 design focus，不要挤占参数表。"
    ]
  },
  "rf-switch": {
    id: "rf-switch",
    title: "RF Switch",
    aliases: ["rf switch", "spdt", "sp4t", "absorptive switch", "reflective switch"],
    mustExtractFields: [
      "topology",
      "frequency range",
      "insertion loss",
      "isolation",
      "return loss",
      "P1dB / power handling",
      "IP3",
      "switching time",
      "control voltage / logic",
      "package"
    ],
    mustExtractAliases: ["topology", "spdt", "sp4t", "frequency", "insertion loss", "isolation", "return loss", "p1db", "ip3", "switching time", "control voltage", "package"],
    mustReviewTopics: [
      "hot switching limits",
      "reflective vs absorptive behavior",
      "control truth table",
      "port isolation under target load"
    ],
    mustReviewAliases: ["hot switching", "reflective", "absorptive", "truth table", "target load"],
    misreadTraps: [
      "不要只看 insertion loss，必须同时看 isolation 与 power handling",
      "不要忽略 hot switching 与 cold switching 条件区别"
    ],
    readingOrder: [
      "feature list",
      "pin / truth table",
      "electrical specs",
      "switching timing",
      "package"
    ],
    promptAugment: [
      "要明确 topology、反射型/吸收型、控制逻辑和功率处理能力。"
    ]
  },
  lna: {
    id: "lna",
    title: "Low Noise Amplifier",
    aliases: ["lna", "low noise amplifier"],
    mustExtractFields: [
      "frequency range",
      "gain",
      "noise figure",
      "IIP3 / OIP3",
      "P1dB",
      "current consumption",
      "supply voltage",
      "input/output return loss",
      "shutdown / control",
      "package"
    ],
    mustExtractAliases: ["frequency", "gain", "noise figure", "iip3", "oip3", "p1db", "current consumption", "supply voltage", "return loss", "shutdown", "package"],
    mustReviewTopics: [
      "gain vs NF trade-off",
      "linearity under blocker conditions",
      "bias and shutdown sequencing",
      "stability and matching network notes"
    ],
    mustReviewAliases: ["trade-off", "blocker", "bias", "stability", "matching"],
    misreadTraps: [
      "不要只看最低 NF，而忽略 gain 与 IIP3 是否还能接受",
      "不要忽略 return loss / matching 对系统结果的影响"
    ],
    readingOrder: [
      "feature list",
      "electrical characteristics",
      "typical performance curves",
      "control / shutdown",
      "package / application"
    ],
    promptAugment: [
      "LNA 必须同时解释 NF、gain、IIP3，不允许只报单个最优数字。"
    ]
  },
  "rf-transceiver": {
    id: "rf-transceiver",
    title: "RF Transceiver",
    aliases: ["transceiver", "rf transceiver", "trx"],
    mustExtractFields: [
      "frequency range",
      "channel bandwidth",
      "tx output power",
      "tx evm / spectral purity",
      "rx noise figure / sensitivity",
      "AGC / power control",
      "clock / LO integration",
      "digital interface",
      "power consumption",
      "package"
    ],
    mustExtractAliases: ["frequency", "channel bandwidth", "tx output power", "evm", "spectral purity", "noise figure", "sensitivity", "agc", "power control", "digital interface", "power consumption", "package"],
    mustReviewTopics: [
      "duplexing or TDD/FDD mode limits",
      "clocking / LO dependencies",
      "blocker or coexistence performance",
      "host digital interface and calibration flow"
    ],
    mustReviewAliases: ["duplex", "tdd", "fdd", "clocking", "lo", "blocker", "coexistence", "calibration"],
    misreadTraps: [
      "不要只看灵敏度，必须连同 blocker / coexistence 条件一起看",
      "不要把实验室最优 EVM 当作系统级保证值"
    ],
    readingOrder: [
      "overview / feature list",
      "receiver specs",
      "transmitter specs",
      "digital interface / calibration",
      "clocking / package"
    ],
    promptAugment: [
      "必须把 TX 与 RX 指标分开解释，并明确依赖的带宽、调制和校准条件。"
    ]
  },
  "pll-vco-synthesizer": {
    id: "pll-vco-synthesizer",
    title: "PLL / VCO / Synthesizer",
    aliases: ["pll", "vco", "synthesizer", "fractional-n pll"],
    mustExtractFields: [
      "output frequency range",
      "phase noise",
      "spurs",
      "lock time",
      "reference input range",
      "channel step / fractional capability",
      "integrated VCO",
      "power consumption",
      "control interface",
      "supply voltage"
    ],
    mustExtractAliases: ["output frequency range", "phase noise", "spurs", "lock time", "reference input", "fractional", "vco", "power consumption", "control interface", "supply voltage"],
    mustReviewTopics: [
      "phase noise vs lock time trade-off",
      "reference source quality dependency",
      "spur mitigation settings",
      "loop filter and layout sensitivity"
    ],
    mustReviewAliases: ["trade-off", "reference source", "spur mitigation", "loop filter", "layout"],
    misreadTraps: [
      "不要只看 phase noise 某一个 offset 点",
      "不要忽略 spur、lock time 与参考时钟质量之间的耦合"
    ],
    readingOrder: [
      "feature list",
      "frequency plan / block diagram",
      "phase noise and spur tables",
      "lock time / control interface",
      "loop filter / layout"
    ],
    promptAugment: [
      "必须同时解释 phase noise、spurs、lock time，不能只报频率覆盖。"
    ]
  }
};

const externalToInternalRfTemplateMap: Record<string, string> = {
  wifi: "wifi-fem",
  "cellular-3g4g5g": "cellular-pam",
  "rf-general": "rf-general"
};

export function listRfTemplateDefinitions() {
  return Object.values(rfTemplateDefinitions);
}

export function getRfTemplateDefinition(templateId: string) {
  return rfTemplateDefinitions[templateId] ?? null;
}

export function resolveRfTemplateDefinition(templateId: string) {
  const internalId = externalToInternalRfTemplateMap[templateId] ?? templateId;
  return getRfTemplateDefinition(internalId);
}
