import { describe, expect, test } from "vitest";

import {
  buildPromptBundle,
  getBaseRolePrompt,
  getDeviceClassPrompt,
  getFollowUpOutputContractPrompt,
  getReportOutputContractPrompt,
  REPORT_PROMPT_VERSION,
  resolveKnowledgePack
} from "@/lib/prompt-templates";

describe("prompt templates", () => {
  test("base role prompt keeps the teaching-style datasheet reading skeleton", () => {
    const prompt = getBaseRolePrompt();

    expect(prompt).toContain("资深硬件工程师");
    expect(prompt).toContain("Absolute Maximum Ratings");
    expect(prompt).toContain("Electrical Characteristics");
    expect(prompt).toContain("test condition");
    expect(prompt).toContain("typical");
  });

  test("rf-general prompt reflects an engineer-grade RF reading template", () => {
    const prompt = getDeviceClassPrompt("rf-general");

    expect(prompt).toContain("PA");
    expect(prompt).toContain("LNA");
    expect(prompt).toContain("FEM");
    expect(prompt).toContain("switch");
    expect(prompt).toContain("noise figure");
    expect(prompt).toContain("ACLR");
    expect(prompt).toContain("EVM");
    expect(prompt).toContain("Absolute Maximum");
    expect(prompt).toContain("Typical");
    expect(prompt).toContain("layout");
    expect(prompt).toContain("thermal");
  });

  test("wifi prompt emphasizes fem-specific RF concerns", () => {
    const prompt = getDeviceClassPrompt("wifi");

    expect(prompt).toContain("FEM");
    expect(prompt).toContain("2.4G/5G");
    expect(prompt).toContain("RX/TX");
    expect(prompt).toContain("noise figure");
  });

  test("wifi prompt draws a hard boundary against cellular pam classification", () => {
    const prompt = getDeviceClassPrompt("wifi");

    expect(prompt).toContain("802.11ax");
    expect(prompt).toContain("Wi-Fi 6");
    expect(prompt).toContain("HE160");
    expect(prompt).toContain("VHT80");
    expect(prompt).toContain("不能归到 cellular");
    expect(prompt).toContain("NR/LTE/WCDMA/TD-SCDMA");
  });

  test("cellular prompt emphasizes band and rffe constraints", () => {
    const prompt = getDeviceClassPrompt("cellular-3g4g5g");

    expect(prompt).toContain("supported bands");
    expect(prompt).toContain("RFFE");
    expect(prompt).toContain("ACLR");
    expect(prompt).toContain("EVM");
    expect(prompt).toContain("HPUE");
    expect(prompt).toContain("bandwidth");
    expect(prompt).toContain("current consumption");
    expect(prompt).toContain("MIPI");
    expect(prompt).toContain("truth table");
  });

  test("report contract prompt locks output schema and version", () => {
    const prompt = getReportOutputContractPrompt();

    expect(REPORT_PROMPT_VERSION).toBeTruthy();
    expect(prompt).toContain(REPORT_PROMPT_VERSION);
    expect(prompt).toContain("只允许输出一个 JSON object");
    expect(prompt).toContain("\"executiveSummary\"");
    expect(prompt).toContain("\"deviceIdentity\"");
    expect(prompt).toContain("\"keyParameters\"");
    expect(prompt).toContain("\"sections\"");
    expect(prompt).toContain("禁止输出 schema 外的新字段");
    expect(prompt).toContain("不允许输出 markdown");
    expect(prompt).toContain("sections[].id 只能使用固定骨架 id");
    expect(prompt).toContain("禁止输出 step_*");
    expect(prompt).toContain("线性输出");
    expect(prompt).toContain("饱和输出");
    expect(prompt).toContain("test condition");
    expect(prompt).toContain("modulation");
    expect(prompt).toContain("bandwidth");
    expect(prompt).toContain("layout");
    expect(prompt).toContain("thermal");
    expect(prompt).toContain("control interface");
  });

  test("follow-up contract prompt locks answer schema", () => {
    const prompt = getFollowUpOutputContractPrompt();

    expect(prompt).toContain("answer");
    expect(prompt).toContain("claims");
    expect(prompt).toContain("citations");
    expect(prompt).toContain("usedSources");
    expect(prompt).toContain("followUpWarnings");
    expect(prompt).toContain("sourceType");
  });

  test("resolves RF knowledge pack for wifi follow-up", () => {
    const knowledgePack = resolveKnowledgePack("wifi", "follow-up-answer");

    expect(knowledgePack.knowledgeIds).toEqual(
      expect.arrayContaining(["rf-overview", "rf-reading-method", "rf-misread-traps", "wifi-fem"])
    );
    expect(knowledgePack.combinedMarkdown).toContain("FEM");
    expect(knowledgePack.combinedMarkdown).toContain("test condition");
    expect(knowledgePack.combinedMarkdown).toContain("layout");
  });

  test("builds a prompt bundle with knowledge injection for RF follow-up", () => {
    const bundle = buildPromptBundle("follow-up-answer", {
      templateId: "cellular-3g4g5g",
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q"
    });

    expect(bundle.version).toBeTruthy();
    expect(bundle.systemPrompt).toContain("资深硬件工程师");
    expect(bundle.systemPrompt).toContain("Cellular");
    expect(bundle.systemPrompt).toContain("RFFE");
    expect(bundle.systemPrompt).toContain("暗知识");
    expect(bundle.systemPrompt).toContain("followUpWarnings");
    expect(bundle.knowledgeIds).toEqual(
      expect.arrayContaining(["rf-overview", "rf-reading-method", "rf-misread-traps", "cellular-pam"])
    );
  });

  test("wifi synthesize-report prompt explicitly asks for field-level RF extraction", () => {
    const bundle = buildPromptBundle("synthesize-report", {
      templateId: "wifi",
      fileName: "UPF5755.pdf",
      taskName: "UPF5755 初步分析",
      chipName: "UPF5755"
    });

    expect(bundle.systemPrompt).toContain("RF 模板必须优先抽取");
    expect(bundle.systemPrompt).toContain("frequency coverage");
    expect(bundle.systemPrompt).toContain("tx linear output power");
    expect(bundle.systemPrompt).toContain("noise figure");
    expect(bundle.systemPrompt).toContain("truth table");
    expect(bundle.systemPrompt).toContain("必须优先按当前 parameter template 的字段名组织 keyParameters");
    expect(bundle.systemPrompt).toContain("不要用泛化字段 Features 代替");
    expect(bundle.systemPrompt).toContain("RF > FEM > Wi-Fi FEM");
    expect(bundle.systemPrompt).toContain("标准字段名");
    expect(bundle.systemPrompt).toContain("字段别名映射");
    expect(bundle.systemPrompt).toContain("不要把 layout、thermal、compatibility、preliminary status 放进 keyParameters");
    expect(bundle.systemPrompt).toContain("如果标准字段缺少 datasheet 证据，允许留空");
    expect(bundle.systemPrompt).toContain("802.11");
    expect(bundle.systemPrompt).toContain("HE160");
    expect(bundle.systemPrompt).toContain("VHT80");
    expect(bundle.systemPrompt).toContain("不得输出 cellular 模板");
  });

  test("rf follow-up prompt explicitly tells the model to map user questions to RF field aliases", () => {
    const bundle = buildPromptBundle("follow-up-answer", {
      templateId: "wifi",
      fileName: "UPF5755.pdf",
      taskName: "UPF5755 follow-up",
      chipName: "UPF5755"
    });

    expect(bundle.systemPrompt).toContain("如果用户问题对应 RF 参数别名");
    expect(bundle.systemPrompt).toContain("Frequency Coverage");
    expect(bundle.systemPrompt).toContain("Frequency Range");
    expect(bundle.systemPrompt).toContain("Supported Bands");
    expect(bundle.systemPrompt).toContain("Supply Voltage");
    expect(bundle.systemPrompt).toContain("先在当前 report 和 parameter store 里找标准字段");
    expect(bundle.systemPrompt).toContain("找不到再明确说明当前资料未覆盖");
  });

  test("report contract prompt defines slot boundaries for parameters, risks and open questions", () => {
    const prompt = getReportOutputContractPrompt();

    expect(prompt).toContain("keyParameters 只承载结构化参数真值");
    expect(prompt).toContain("designFocus 用于设计关注点");
    expect(prompt).toContain("risks 用于风险、误读和兼容性问题");
    expect(prompt).toContain("openQuestions 用于 datasheet 未覆盖");
    expect(prompt).toContain("不要把待确认问题写成参数项");
  });

  test("wifi device prompt exposes parameter fields and alias mapping instead of only prose", () => {
    const prompt = getDeviceClassPrompt("wifi");

    expect(prompt).toContain("模板语义层级：RF > FEM > Wi-Fi FEM");
    expect(prompt).toContain("标准字段名");
    expect(prompt).toContain("RF Type");
    expect(prompt).toContain("TX Linear Output Power");
    expect(prompt).toContain("EVM / ACLR Condition");
    expect(prompt).toContain("字段别名映射");
    expect(prompt).toContain("power detector");
    expect(prompt).toContain("不要放进 keyParameters");
  });

  test("serial-flash prompt exposes memory hierarchy, fields and alias mapping", () => {
    const prompt = getDeviceClassPrompt("serial-flash");

    expect(prompt).toContain("模板语义层级：Memory > Serial Flash");
    expect(prompt).toContain("标准字段名");
    expect(prompt).toContain("Memory Size / Density");
    expect(prompt).toContain("Interface / I/O Mode");
    expect(prompt).toContain("Max Clock Frequency");
    expect(prompt).toContain("字段别名映射");
    expect(prompt).toContain("QPI");
    expect(prompt).toContain("不要放进 keyParameters");
  });

  test("serial-flash synthesize-report prompt asks for field-level flash extraction", () => {
    const bundle = buildPromptBundle("synthesize-report", {
      templateId: "serial-flash",
      fileName: "GD25Q128E.pdf",
      taskName: "GD25Q128E 初步分析",
      chipName: "GD25Q128E"
    });

    expect(bundle.systemPrompt).toContain("Memory > Serial Flash");
    expect(bundle.systemPrompt).toContain("Technology / Memory Type");
    expect(bundle.systemPrompt).toContain("Memory Size / Density");
    expect(bundle.systemPrompt).toContain("Interface / I/O Mode");
    expect(bundle.systemPrompt).toContain("Program / Erase Time");
    expect(bundle.systemPrompt).toContain("先映射到当前 parameter template 的标准字段名再输出");
  });
});
