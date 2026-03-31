import { describe, expect, test } from "vitest";

import {
  getRfTemplateDefinition,
  listRfTemplateDefinitions,
  resolveRfTemplateDefinition
} from "@/lib/rf-template-registry";

describe("rf template registry", () => {
  test("registers the core rf subtemplates for v1", () => {
    const ids = listRfTemplateDefinitions().map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        "rf-general",
        "wifi-fem",
        "cellular-pam",
        "rf-switch",
        "lna",
        "rf-transceiver",
        "pll-vco-synthesizer"
      ])
    );
  });

  test("resolves external stable wifi and cellular templates to internal rf subtemplates", () => {
    expect(resolveRfTemplateDefinition("wifi")?.id).toBe("wifi-fem");
    expect(resolveRfTemplateDefinition("cellular-3g4g5g")?.id).toBe("cellular-pam");
    expect(resolveRfTemplateDefinition("rf-general")?.id).toBe("rf-general");
  });

  test("cellular pam template defines thick must-extract fields", () => {
    const template = getRfTemplateDefinition("cellular-pam");

    expect(template?.mustExtractFields).toEqual(
      expect.arrayContaining([
        "supported bands",
        "bandwidth capability",
        "maximum linear output power",
        "aclr / evm condition",
        "rffe / mipi version",
        "current consumption",
        "vcc / supply",
        "package"
      ])
    );
  });

  test("wifi fem template defines rf-fem-specific engineering checks", () => {
    const template = getRfTemplateDefinition("wifi-fem");

    expect(template?.mustExtractFields).toEqual(
      expect.arrayContaining([
        "frequency coverage",
        "tx linear output power",
        "evm condition",
        "rx gain",
        "noise figure",
        "bypass loss",
        "control mode / truth table",
        "package"
      ])
    );
    expect(template?.misreadTraps).toEqual(
      expect.arrayContaining([
        "不要把最大输出功率当作满足 EVM 条件的线性输出功率",
        "不要忽略 RX gain mode 与 bypass mode 的差异"
      ])
    );
  });

  test("pll template captures phase-noise-centric evaluation", () => {
    const template = getRfTemplateDefinition("pll-vco-synthesizer");

    expect(template?.mustExtractFields).toEqual(
      expect.arrayContaining([
        "output frequency range",
        "phase noise",
        "spurs",
        "lock time",
        "reference input range",
        "control interface"
      ])
    );
  });
});
