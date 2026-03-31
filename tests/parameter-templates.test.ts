import { describe, expect, test } from "vitest";

import { getParameterTemplate } from "@/lib/parameter-templates";

describe("parameter templates", () => {
  test("wifi template covers RF FEM reading dimensions used by current RF templates", () => {
    const template = getParameterTemplate("wifi");
    const fieldNames = template.fields.map((field) => field.name);

    expect(template.focusAreas).toEqual(
      expect.arrayContaining([
        "Frequency coverage",
        "TX linear output power",
        "RX gain / noise figure / bypass loss",
        "Control truth table",
        "Supply voltage",
        "Package / layout"
      ])
    );
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "RF Type",
        "Frequency Coverage",
        "TX Linear Output Power",
        "EVM / ACLR Condition",
        "RX Gain / Noise Figure / Bypass Loss",
        "Control Mode / Truth Table",
        "Supply Voltage",
        "Package / Case"
      ])
    );
  });

  test("rf-general template covers broad RF datasheet reading dimensions", () => {
    const template = getParameterTemplate("rf-general");
    const fieldNames = template.fields.map((field) => field.name);

    expect(template.focusAreas).toEqual(
      expect.arrayContaining([
        "Frequency range / bands",
        "Linear output power",
        "Gain / noise figure / isolation",
        "Control interface / timing",
        "Supply / current",
        "Package / thermal / layout"
      ])
    );
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "Device Role",
        "Frequency Range / Supported Bands",
        "Output Power / Linear Output Power",
        "Gain / Insertion Loss / Noise Figure / Isolation",
        "Control Interface / Truth Table / Switching Time",
        "Supply Voltage / Current Consumption",
        "Package / Thermal / Layout"
      ])
    );
  });

  test("wlan-fem alias stays aligned with wifi RF template fields", () => {
    const template = getParameterTemplate("wlan-fem");
    const fieldNames = template.fields.map((field) => field.name);

    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "Frequency Coverage",
        "TX Linear Output Power",
        "Control Mode / Truth Table",
        "Supply Voltage"
      ])
    );
  });

  test("serial-flash template covers spi nor datasheet reading dimensions", () => {
    const template = getParameterTemplate("serial-flash");
    const fieldNames = template.fields.map((field) => field.name);

    expect(template.focusAreas).toEqual(
      expect.arrayContaining([
        "Memory density / organization",
        "SPI / Dual / Quad / QPI interface",
        "Clock frequency / access performance",
        "Supply / current",
        "Erase / program architecture",
        "Protection / package"
      ])
    );
    expect(fieldNames).toEqual(
      expect.arrayContaining([
        "Technology / Memory Type",
        "Memory Size / Density",
        "Organization",
        "Interface / I/O Mode",
        "Max Clock Frequency",
        "Supply Voltage",
        "Active / Power-Down Current",
        "Page / Sector / Block Architecture",
        "Program / Erase Time",
        "Protection / Security Features",
        "Operating Temperature",
        "Package / Case"
      ])
    );
  });
});
