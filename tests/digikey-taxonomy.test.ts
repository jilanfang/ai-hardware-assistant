import { describe, expect, test } from "vitest";

import { loadDigikeyTaxonomy, matchDigikeyCategory } from "@/lib/digikey-taxonomy";

describe("DigiKey taxonomy matching", () => {
  test("matches RF front-end text to DigiKey RF Front End (LNA + PA)", async () => {
    const taxonomy = await loadDigikeyTaxonomy();
    const category = matchDigikeyCategory(
      "SKY85755-11 5 GHz WLAN Front-End Module Transmit gain: 32 dB Receive gain: 14 dB Small QFN package",
      taxonomy
    );

    expect(category?.slug).toBe("rf-front-end-lna-pa");
    expect(category?.categoryPath.at(-1)).toBe("RF Front End (LNA + PA)");
    expect(category?.parameterFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: "RF Type" }),
        expect.objectContaining({ normalizedName: "Frequency" }),
        expect.objectContaining({ normalizedName: "Features" }),
        expect.objectContaining({ normalizedName: "Package / Case" })
      ])
    );
  });

  test("matches buck regulator text to DigiKey DC DC Switching Regulators instead of RF", async () => {
    const taxonomy = await loadDigikeyTaxonomy();
    const category = matchDigikeyCategory(
      "LMR51430 buck converter VIN operating range 4.5 V to 36 V 3-A output current Programmable switching frequency up to 2.1 MHz Package options SOT-23-THN",
      taxonomy
    );

    expect(category?.slug).toBe("voltage-regulators-dc-dc-switching-regulators");
    expect(category?.parameterFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: "Function" }),
        expect.objectContaining({ normalizedName: "Voltage - Input (Min)" }),
        expect.objectContaining({ normalizedName: "Voltage - Input (Max)" }),
        expect.objectContaining({ normalizedName: "Current - Output" }),
        expect.objectContaining({ normalizedName: "Frequency - Switching" })
      ])
    );
  });

  test("matches ldo text to DigiKey Linear, Low Drop Out (LDO) Regulators", async () => {
    const taxonomy = await loadDigikeyTaxonomy();
    const category = matchDigikeyCategory(
      "TLV76701 low-dropout linear regulator adjustable output 16 V input 0.8 V to 13.6 V 1 A output current 1.4 V @ 1A dropout 6-WSON",
      taxonomy
    );

    expect(category?.slug).toBe("voltage-regulators-linear-low-drop-out-ldo-regulators");
    expect(category?.categoryPath.at(-1)).toBe("Voltage Regulators - Linear, Low Drop Out (LDO) Regulators");
    expect(category?.parameterFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: "Output Type" }),
        expect.objectContaining({ normalizedName: "Voltage - Input (Max)" }),
        expect.objectContaining({ normalizedName: "Voltage - Output (Min/Fixed)" }),
        expect.objectContaining({ normalizedName: "Voltage Dropout (Max)" }),
        expect.objectContaining({ normalizedName: "Current - Output" })
      ])
    );
  });
});
