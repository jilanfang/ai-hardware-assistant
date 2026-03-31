import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getParameterTemplate } from "@/lib/parameter-templates";
import { resolveRfTemplateDefinition } from "@/lib/rf-template-registry";

type DeviceTemplateDefinition = {
  templateId: string;
  title: string;
  coreParameters: string[];
  prioritySections: string[];
  commonMisreads: string[];
  juniorTerms: string[];
  reportSections: string[];
};

type PromptTask =
  | "classify-identity"
  | "synthesize-report"
  | "follow-up-answer"
  | "repair-json"
  | "public-search-summarize";

type PromptBundleInput = {
  templateId: string;
  fileName: string;
  taskName: string;
  chipName: string;
  language?: string;
  teachingMode?: boolean;
  requireParameterTable?: boolean;
  requireRiskTable?: boolean;
};

type KnowledgePack = {
  knowledgeIds: string[];
  combinedMarkdown: string;
};

type TemplatePromptSpec = {
  hierarchy: string;
  aliasMappings: Array<{
    field: string;
    aliases: string[];
  }>;
  forbiddenInKeyParameters: string[];
};

export const REPORT_PROMPT_VERSION = "report-v3-bundled";
export const FOLLOW_UP_PROMPT_VERSION = "follow-up-v1-grounded";

const FIXED_REPORT_SECTION_IDS = [
  "device_identity",
  "what_this_part_is_for",
  "how_to_read_this_datasheet",
  "key_parameters",
  "section_by_section_reading_order",
  "critical_graphs_and_tables",
  "risks_and_gotchas",
  "intern_action_list",
  "open_questions",
  "glossary_for_juniors"
] as const;

const repoRoot = process.cwd();

function readTextFile(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), "utf8").trim();
}

const baseRolePrompt = readTextFile("prompts/base/role/system.md");
const taskInstructions = {
  "classify-identity": readTextFile("prompts/tasks/classify-identity/instructions.md"),
  "synthesize-report": readTextFile("prompts/tasks/synthesize-report/instructions.md"),
  "follow-up-answer": readTextFile("prompts/tasks/follow-up-answer/instructions.md"),
  "repair-json": readTextFile("prompts/tasks/repair-json/instructions.md"),
  "public-search-summarize": readTextFile("prompts/tasks/public-search-summarize/instructions.md")
} satisfies Record<PromptTask, string>;
const reportContract = JSON.parse(readTextFile("prompts/contracts/report-output.json")) as {
  version: string;
  sectionIds: string[];
};
const followUpContract = JSON.parse(readTextFile("prompts/contracts/follow-up-output.json")) as {
  version: string;
};

const knowledgeFileMap: Record<string, string> = {
  "rf-overview": "docs/knowledge/rf/rf-overview.md",
  "rf-reading-method": "docs/knowledge/rf/rf-reading-method.md",
  "rf-misread-traps": "docs/knowledge/rf/rf-misread-traps.md",
  "wifi-fem": "docs/knowledge/rf/wifi-fem.md",
  "cellular-pam": "docs/knowledge/rf/cellular-pam.md",
  "rf-switch": "docs/knowledge/rf/rf-switch.md",
  lna: "docs/knowledge/rf/lna.md",
  "rf-transceiver": "docs/knowledge/rf/rf-transceiver.md",
  "pll-vco-synthesizer": "docs/knowledge/rf/pll-vco-synthesizer.md"
};

const deviceTemplateDefinitions: Record<string, DeviceTemplateDefinition> = {
  "rf-general": {
    templateId: "rf-general",
    title: "RF 通用模板",
    coreParameters: [
      "device role in RF chain (PA / LNA / FEM / switch / front-end module)",
      "frequency range / supported bands",
      "output power / linear output power",
      "gain / insertion loss / bypass loss",
      "linearity (ACLR / ACPR / EVM)",
      "noise figure / IIP3 / OIP3 / isolation",
      "control interface / truth table / switching time",
      "package / layout / thermal grounding"
    ],
    prioritySections: [
      "cover page / feature list / target application",
      "block diagram / functional description",
      "band or frequency coverage table",
      "electrical characteristics with test condition",
      "control truth table / timing",
      "package / pinout / layout guide",
      "typical RF performance graphs"
    ],
    commonMisreads: [
      "把 Absolute Maximum 当正常工作条件",
      "把 Typical 当 guaranteed / min-max",
      "把饱和功率当线性输出功率",
      "忽略 ACLR / ACPR / EVM 的 test condition",
      "忽略 bypass 模式与 gain 模式差异",
      "忽略封装地焊盘、layout 和 thermal 对 RF 性能的影响"
    ],
    juniorTerms: [
      "PA",
      "LNA",
      "FEM",
      "switch",
      "noise figure",
      "IIP3",
      "OIP3",
      "ACLR",
      "ACPR",
      "EVM",
      "PAE",
      "insertion loss",
      "isolation",
      "bypass"
    ],
    reportSections: [
      "what_this_part_is_for",
      "how_to_read_this_datasheet",
      "critical_graphs_and_tables",
      "risks_and_gotchas",
      "intern_action_list",
      "glossary_for_juniors"
    ]
  },
  audio: {
    templateId: "audio",
    title: "Audio 模板",
    coreParameters: ["output power", "THD+N", "SNR", "PSRR", "gain setting", "load condition", "thermal/package"],
    prioritySections: ["overview", "audio performance table", "test setup", "application circuits", "thermal/package"],
    commonMisreads: ["忽略负载和电源条件", "把典型失真当保证值", "忽略增益配置依赖"],
    juniorTerms: ["THD+N", "SNR", "PSRR", "gain", "load"],
    reportSections: ["key_parameters", "section_by_section_reading_order", "glossary_for_juniors"]
  },
  "cellular-3g4g5g": {
    templateId: "cellular-3g4g5g",
    title: "蜂窝通信模板",
    coreParameters: [
      "supported bands / mode coverage",
      "linear output power",
      "ACLR / EVM / linearity",
      "APT / ET context and current consumption",
      "RFFE / control interface / truth table",
      "HPUE or bandwidth capability",
      "package / layout / thermal"
    ],
    prioritySections: ["feature list", "supported bands", "block diagram", "electrical characteristics", "control interface", "layout/application"],
    commonMisreads: [
      "忽略 band / mode / bandwidth 条件",
      "把 marketing power 当 datasheet guarantee",
      "只看 dBm 不看 ACLR / EVM",
      "忽略 HPUE 或高带宽模式的热和电流代价",
      "忽略 RFFE 版本和主控兼容性"
    ],
    juniorTerms: ["PAM", "RFFE", "band", "mode", "ACLR", "EVM", "HPUE", "APT"],
    reportSections: ["how_to_read_this_datasheet", "critical_graphs_and_tables", "risks_and_gotchas", "intern_action_list"]
  },
  wifi: {
    templateId: "wifi",
    title: "Wi‑Fi 模板",
    coreParameters: [
      "2.4G/5G frequency coverage",
      "TX output power and linearity",
      "RX gain / noise figure",
      "bypass / insertion loss / isolation",
      "FEM control pins and RX/TX mode table",
      "package / layout / external matching"
    ],
    prioritySections: ["feature list", "functional block diagram", "RF performance", "truth table / timing", "application circuit", "layout guidance"],
    commonMisreads: [
      "忽略 2.4G/5G 条件差异",
      "忽略 RX/TX 模式切换条件",
      "把 NF 和增益分开看而不看同一模式",
      "忽略外部匹配和封装布局",
      "看到 5GHz / 802.11ax / Wi-Fi 6 / HE160 / VHT80 就被 5G 一词误导成 cellular"
    ],
    juniorTerms: ["FEM", "LNA", "PA", "RX/TX", "noise figure", "bypass", "EVM", "Wi-Fi 6", "HE160", "VHT80"],
    reportSections: ["what_this_part_is_for", "how_to_read_this_datasheet", "key_parameters", "risks_and_gotchas"]
  },
  power: {
    templateId: "power",
    title: "Power 模板",
    coreParameters: ["input range", "output range/current", "switching frequency or dropout", "efficiency", "thermal", "package/layout"],
    prioritySections: ["overview", "absolute max", "recommended operating conditions", "electrical characteristics", "layout guidance"],
    commonMisreads: ["把 absolute max 当工作条件", "忽略效率曲线对应条件", "忽略散热和外围件依赖"],
    juniorTerms: ["dropout", "switching frequency", "efficiency", "load regulation", "thermal pad"],
    reportSections: ["how_to_read_this_datasheet", "risks_and_gotchas", "intern_action_list"]
  },
  "serial-flash": {
    templateId: "serial-flash",
    title: "Serial Flash 模板",
    coreParameters: [
      "memory type / density / organization",
      "spi / dual / quad / qpi interface",
      "clock frequency / access performance",
      "supply voltage / active current / power-down current",
      "page / sector / block architecture",
      "program / erase timing",
      "security / protection / package"
    ],
    prioritySections: [
      "cover page / feature list",
      "memory organization",
      "command set / interface modes",
      "electrical characteristics",
      "ac characteristics / timing",
      "protection features",
      "package information"
    ],
    commonMisreads: [
      "把 marketing 文案里的 Quad SPI 当成所有模式默认开启",
      "只看容量，不看 page / sector / block 擦除粒度",
      "忽略 program / erase 时间与系统吞吐的关系",
      "忽略写保护、OTP、reset、suspend / resume 等安全控制"
    ],
    juniorTerms: ["NOR Flash", "SPI", "Dual SPI", "Quad SPI", "QPI", "sector erase", "page program", "OTP"],
    reportSections: ["key_parameters", "how_to_read_this_datasheet", "risks_and_gotchas", "glossary_for_juniors"]
  },
  "generic-fallback": {
    templateId: "generic-fallback",
    title: "Generic 回退模板",
    coreParameters: ["identity", "application", "headline electrical specs", "control/package", "system risk"],
    prioritySections: ["cover page", "feature list", "electrical characteristics", "pin/package", "application"],
    commonMisreads: ["只看首页卖点", "忽略条件和脚注", "忽略封装和控制依赖"],
    juniorTerms: ["test condition", "typical", "recommended operating conditions"],
    reportSections: ["section_by_section_reading_order", "open_questions", "glossary_for_juniors"]
  }
};

const templatePromptSpecs: Record<string, TemplatePromptSpec> = {
  wifi: {
    hierarchy: "RF > FEM > Wi-Fi FEM",
    aliasMappings: [
      { field: "RF Type", aliases: ["wlan type", "wireless standard", "802.11ac", "802.11ax", "802.11be"] },
      { field: "Frequency Coverage", aliases: ["frequency range", "supported bands", "2.4g", "5g", "6g"] },
      { field: "TX Linear Output Power", aliases: ["tx output power", "linear output power", "output power"] },
      { field: "EVM / ACLR Condition", aliases: ["evm", "aclr", "devm", "mcs", "modulation", "bandwidth"] },
      { field: "RX Gain / Noise Figure / Bypass Loss", aliases: ["rx gain", "gain", "noise figure", "rx nf", "bypass loss", "insertion loss", "isolation"] },
      { field: "Control Mode / Truth Table", aliases: ["truth table", "control mode", "switching logic", "rx/tx mode table"] },
      { field: "Supply Voltage", aliases: ["operating voltage", "vcc", "supply"] },
      { field: "Package / Case", aliases: ["package", "package / case", "qfn", "footprint"] }
    ],
    forbiddenInKeyParameters: ["layout", "thermal", "compatibility", "preliminary status", "待确认项", "open questions"]
  },
  "cellular-3g4g5g": {
    hierarchy: "RF > Cellular > PAM / PA",
    aliasMappings: [
      { field: "Supported bands", aliases: ["band support", "supported modes", "mode coverage"] },
      { field: "Bandwidth Capability", aliases: ["100mhz", "bandwidth", "carrier aggregation"] },
      { field: "Maximum Linear Output Power", aliases: ["linear output power", "max linear power", "output power"] },
      { field: "ACLR / EVM Condition", aliases: ["aclr", "evm", "modulation", "bandwidth condition"] },
      { field: "RFFE bus", aliases: ["rffe", "mipi", "control interface", "truth table"] },
      { field: "Current Consumption", aliases: ["current", "icc", "supply current"] },
      { field: "VCC / Supply", aliases: ["vcc", "supply voltage", "operating voltage", "apt", "et"] },
      { field: "Package", aliases: ["package", "package / case", "footprint"] }
    ],
    forbiddenInKeyParameters: ["layout", "thermal", "compatibility", "document status", "preliminary status", "待确认项", "open questions"]
  },
  "rf-general": {
    hierarchy: "RF > Generic RF Device",
    aliasMappings: [
      { field: "Device Role", aliases: ["rf type", "role", "front-end role"] },
      { field: "Frequency Range / Supported Bands", aliases: ["frequency coverage", "frequency range", "supported bands"] },
      { field: "Output Power / Linear Output Power", aliases: ["linear output power", "output power"] },
      { field: "Gain / Insertion Loss / Noise Figure / Isolation", aliases: ["gain", "noise figure", "insertion loss", "isolation", "iip3", "oip3"] },
      { field: "Control Interface / Truth Table / Switching Time", aliases: ["control interface", "truth table", "switching time"] },
      { field: "Supply Voltage / Current Consumption", aliases: ["supply voltage", "operating voltage", "current consumption"] },
      { field: "Package / Thermal / Layout", aliases: ["package", "thermal", "layout"] }
    ],
    forbiddenInKeyParameters: ["compatibility", "document status", "待确认项", "open questions"]
  },
  "serial-flash": {
    hierarchy: "Memory > Serial Flash",
    aliasMappings: [
      { field: "Technology / Memory Type", aliases: ["memory type", "technology", "nor", "non-volatile", "serial flash"] },
      { field: "Memory Size / Density", aliases: ["memory size", "density", "128mbit", "16mb"] },
      { field: "Organization", aliases: ["memory organization", "organization", "x8"] },
      { field: "Interface / I/O Mode", aliases: ["memory interface", "spi", "dual spi", "quad spi", "qpi", "quad i/o"] },
      { field: "Max Clock Frequency", aliases: ["clock frequency", "speed", "max frequency", "max clock"] },
      { field: "Supply Voltage", aliases: ["voltage - supply", "operating voltage", "vcc", "supply"] },
      { field: "Active / Power-Down Current", aliases: ["active current", "read current", "power-down current", "standby current"] },
      { field: "Page / Sector / Block Architecture", aliases: ["page size", "sector size", "block size", "erase architecture", "uniform sector"] },
      { field: "Program / Erase Time", aliases: ["write cycle time", "page program time", "sector erase time", "erase time"] },
      { field: "Protection / Security Features", aliases: ["write protection", "otp", "unique id", "reset", "suspend", "security register"] },
      { field: "Operating Temperature", aliases: ["operating temperature", "temperature range"] },
      { field: "Package / Case", aliases: ["package", "package / case", "wson", "soic", "tfbga"] }
    ],
    forbiddenInKeyParameters: ["application examples", "marketing summary", "selection advice", "待确认项", "open questions"]
  }
};

function resolveRfKnowledgeIds(templateId: string) {
  const rfSubtemplate = resolveRfTemplateDefinition(templateId);
  if (!rfSubtemplate) {
    return [];
  }

  return ["rf-overview", "rf-reading-method", "rf-misread-traps", rfSubtemplate.id];
}

export function resolveKnowledgePack(templateId: string, taskType: PromptTask): KnowledgePack {
  const ids = resolveRfKnowledgeIds(templateId);
  const combinedMarkdown = ids
    .map((id) => {
      const path = knowledgeFileMap[id];
      if (!path) return "";
      return `## 暗知识 ${id}\n${readTextFile(path)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return {
    knowledgeIds: ids,
    combinedMarkdown:
      combinedMarkdown || `## 暗知识\n当前任务 ${taskType} 没有额外知识注入，请严格依赖 datasheet 与当前结构化上下文。`
  };
}

export function getBaseRolePrompt() {
  return baseRolePrompt;
}

export function getDeviceClassPrompt(templateId: string) {
  const definition = deviceTemplateDefinitions[templateId] ?? deviceTemplateDefinitions["generic-fallback"];
  const rfSubtemplate = resolveRfTemplateDefinition(templateId);
  const parameterTemplate = getParameterTemplate(templateId);
  const promptSpec = templatePromptSpecs[templateId];
  const parameterFieldBlock = [
    "标准字段名：",
    ...parameterTemplate.fields.map((field) => `- ${field.name}: ${field.description}`)
  ].join("\n");
  const aliasMappingBlock = promptSpec
    ? [
        "字段别名映射：",
        ...promptSpec.aliasMappings.map((mapping) => `- ${mapping.field} <= ${mapping.aliases.join(" | ")}`)
      ].join("\n")
    : "";
  const forbiddenBlock = promptSpec
    ? `不要放进 keyParameters：${promptSpec.forbiddenInKeyParameters.join("、")}`
    : "不要放进 keyParameters：纯工程建议、兼容性担忧、待确认项、open questions。";
  const structuredTemplateBlock = promptSpec
    ? [
        `模板语义层级：${promptSpec.hierarchy}`,
        parameterFieldBlock,
        aliasMappingBlock,
        forbiddenBlock
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const rfOverlay = rfSubtemplate
    ? [
        "RF 母模板统一阅读方法：先确认器件在链路中的角色、频段/制式覆盖、线性输出 vs 饱和输出、增益/NF/IIP3/隔离、控制接口与 truth table、package/layout/thermal 风险。",
        `${rfSubtemplate.title}（内部语义层，最终对外模板 ID 不变）`,
        `RF 模板必须优先抽取：${rfSubtemplate.mustExtractFields.join("、")}`,
        `RF 模板必须复核：${rfSubtemplate.mustReviewTopics.join("、")}`,
        `RF 常见误读：${rfSubtemplate.misreadTraps.join("、")}`,
        `RF 推荐阅读顺序：${rfSubtemplate.readingOrder.join("、")}`,
        `RF 子模板重点：${rfSubtemplate.promptAugment.join("、")}`
      ].join("\n")
    : "";

  return [
    `当前类目模板：${definition.title}`,
    `最核心的参数维度：${definition.coreParameters.join("、")}`,
    `应优先看的章节：${definition.prioritySections.join("、")}`,
    `常见误读点：${definition.commonMisreads.join("、")}`,
    `需要向新人解释的术语：${definition.juniorTerms.join("、")}`,
    `报告中必须强化的章节：${definition.reportSections.join("、")}`,
    structuredTemplateBlock,
    rfOverlay
  ]
    .filter(Boolean)
    .join("\n");
}

export function getTaskPrompt(input: {
  fileName: string;
  taskName: string;
  chipName: string;
  language?: string;
  teachingMode?: boolean;
  requireParameterTable?: boolean;
  requireRiskTable?: boolean;
}) {
  return [
    `当前文件：${input.fileName}`,
    `当前任务：${input.taskName}`,
    `当前芯片名：${input.chipName}`,
    `输出语言：${input.language ?? "zh-CN"}`,
    `教学风格：${input.teachingMode === false ? "关闭" : "开启"}`,
    `需要参数表：${input.requireParameterTable === false ? "否" : "是"}`,
    `需要风险表：${input.requireRiskTable === false ? "否" : "是"}`
  ].join("\n");
}

export function getReportOutputContractPrompt() {
  return [
    `报告输出契约版本：${reportContract.version}`,
    "只允许输出一个 JSON object。",
    "不允许输出 markdown、不允许输出解释文字、不允许输出代码块。",
    "禁止输出 schema 外的新字段，禁止修改字段名大小写，禁止把 object 改成 array。",
    "顶层字段必须且只能为：",
    [
      "\"executiveSummary\"",
      "\"deviceIdentity\"",
      "\"keyParameters\"",
      "\"designFocus\"",
      "\"risks\"",
      "\"openQuestions\"",
      "\"publicNotes\"",
      "\"citations\"",
      "\"sections\"",
      "\"claims\""
    ].join(", "),
    "deviceIdentity 必须包含：canonicalPartNumber, manufacturer, deviceClass, parameterTemplateId, confidence。",
    "keyParameters/designFocus/risks/openQuestions/publicNotes/claims 必须是数组，数组元素必须是统一 claim 结构。",
    "keyParameters 只承载结构化参数真值，优先使用当前 parameter template 的标准字段名。",
    "designFocus 用于设计关注点、trade-off、layout / thermal / matching / routing 这类工程落地重点。",
    "risks 用于风险、误读和兼容性问题，不要伪装成参数真值。",
    "openQuestions 用于 datasheet 未覆盖、证据不足或需要进一步核实的问题。",
    "不要把待确认问题写成参数项，也不要把风险或 layout 建议塞进 keyParameters。",
    "claim 结构必须包含：id, label, value, title, body, sourceType, citations。",
    "sections 必须是数组，数组元素必须包含：id, title, body, sourceType, citations。",
    `sections[].id 只能使用固定骨架 id：${reportContract.sectionIds.join(", ")}。`,
    "禁止输出 step_*、sec*、sectionA 之类模型自造 id。",
    "sourceType 只能为 datasheet、public、review 之一。",
    "RF 类报告必须区分线性输出与饱和输出，不允许只报最大 dBm。",
    "RF 类报告必须把 gain / NF / IIP3 / ACLR / EVM 与对应的 mode、test condition、modulation、bandwidth 一起写清。",
    "RF 类报告必须覆盖 layout、thermal、control interface / truth table 风险。",
    "如果无法确定某字段内容，返回空字符串或空数组，不要发明新字段。"
  ].join("\n");
}

export function getFollowUpOutputContractPrompt() {
  return [
    `追问输出契约版本：${followUpContract.version}`,
    "只允许输出一个 JSON object。",
    "顶层字段必须包含：answer, claims, citations, usedSources, followUpWarnings。",
    "claims 必须是统一 claim 结构。",
    "citations 必须是 citation 数组。",
    "usedSources 只能包含 datasheet、public、review。",
    "如果 datasheet 事实没有引用，必须把对应 claim 标为 review。",
    "public claim 必须保留 sourceType=public。"
  ].join("\n");
}

export function buildPromptBundle(task: PromptTask, input: PromptBundleInput) {
  const knowledgePack = resolveKnowledgePack(input.templateId, task);
  const outputContract =
    task === "follow-up-answer" ? getFollowUpOutputContractPrompt() : getReportOutputContractPrompt();

  return {
    version: task === "follow-up-answer" ? FOLLOW_UP_PROMPT_VERSION : REPORT_PROMPT_VERSION,
    knowledgeIds: knowledgePack.knowledgeIds,
    systemPrompt: [
      getBaseRolePrompt(),
      taskInstructions[task],
      outputContract,
      getDeviceClassPrompt(input.templateId),
      "以下是暗知识，只能用于阅读方法、工程解释、误读纠正和优先级判断，不能当作 datasheet 事实来源。",
      knowledgePack.combinedMarkdown
    ]
      .filter(Boolean)
      .join("\n\n"),
    taskPrompt: getTaskPrompt(input)
  };
}
