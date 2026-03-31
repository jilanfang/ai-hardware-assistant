export type DigikeyParameterField = {
  label: string;
  normalizedName: string;
};

export type DigikeyCategoryTemplate = {
  slug: string;
  sourceUrl: string;
  categoryPath: string[];
  matchSignals: string[];
  parameterFields: DigikeyParameterField[];
};

export type DigikeyTaxonomySource = {
  source: "digikey";
  fetchedAt: string | null;
  categories: DigikeyCategoryTemplate[];
};

const fallbackTaxonomy: DigikeyTaxonomySource = {
  source: "digikey",
  fetchedAt: null,
  categories: [
    {
      slug: "rf-front-end-lna-pa",
      sourceUrl: "https://www.digikey.com/en/products/filter/rf-front-end-lna-pa/876",
      categoryPath: ["RF and Wireless", "RF Front End (LNA + PA)"],
      matchSignals: ["wlan front-end module", "front-end module", "transmit gain", "receive gain", "wlan", "wi-fi"],
      parameterFields: [
        { label: "Manufacturer", normalizedName: "Manufacturer" },
        { label: "Series", normalizedName: "Series" },
        { label: "Packaging", normalizedName: "Packaging" },
        { label: "Product Status", normalizedName: "Product Status" },
        { label: "RF Type", normalizedName: "RF Type" },
        { label: "Frequency", normalizedName: "Frequency" },
        { label: "Features", normalizedName: "Features" },
        { label: "Grade", normalizedName: "Grade" },
        { label: "Qualification", normalizedName: "Qualification" },
        { label: "Package / Case", normalizedName: "Package / Case" },
        { label: "Supplier Device Package", normalizedName: "Supplier Device Package" }
      ]
    },
    {
      slug: "voltage-regulators-dc-dc-switching-regulators",
      sourceUrl:
        "https://www.digikey.com/en/products/filter/power-management-pmic/voltage-regulators-dc-dc-switching-regulators/739",
      categoryPath: ["Integrated Circuits (ICs)", "Power Management (PMIC)", "Voltage Regulators - DC DC Switching Regulators"],
      matchSignals: ["buck converter", "switching frequency", "output current", "input voltage"],
      parameterFields: [
        { label: "Manufacturer", normalizedName: "Manufacturer" },
        { label: "Series", normalizedName: "Series" },
        { label: "Packaging", normalizedName: "Packaging" },
        { label: "Product Status", normalizedName: "Product Status" },
        { label: "Function", normalizedName: "Function" },
        { label: "Output Configuration", normalizedName: "Output Configuration" },
        { label: "Topology", normalizedName: "Topology" },
        { label: "Output Type", normalizedName: "Output Type" },
        { label: "Number of Outputs", normalizedName: "Number of Outputs" },
        { label: "Voltage - Input (Min)", normalizedName: "Voltage - Input (Min)" },
        { label: "Voltage - Input (Max)", normalizedName: "Voltage - Input (Max)" },
        { label: "Voltage - Output (Min/Fixed)", normalizedName: "Voltage - Output (Min/Fixed)" },
        { label: "Voltage - Output (Max)", normalizedName: "Voltage - Output (Max)" },
        { label: "Current - Output", normalizedName: "Current - Output" },
        { label: "Frequency - Switching", normalizedName: "Frequency - Switching" },
        { label: "Synchronous Rectifier", normalizedName: "Synchronous Rectifier" },
        { label: "Operating Temperature", normalizedName: "Operating Temperature" },
        { label: "Grade", normalizedName: "Grade" },
        { label: "Qualification", normalizedName: "Qualification" },
        { label: "Mounting Type", normalizedName: "Mounting Type" },
        { label: "Package / Case", normalizedName: "Package / Case" },
        { label: "Supplier Device Package", normalizedName: "Supplier Device Package" }
      ]
    },
    {
      slug: "voltage-regulators-linear-low-drop-out-ldo-regulators",
      sourceUrl:
        "https://www.digikey.com/en/products/filter/power-management-pmic/voltage-regulators-linear-low-drop-out-ldo-regulators/699",
      categoryPath: [
        "Integrated Circuits (ICs)",
        "Power Management (PMIC)",
        "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators"
      ],
      matchSignals: ["low-dropout", "ldo", "linear regulator", "dropout", "adjustable output", "fixed output"],
      parameterFields: [
        { label: "Manufacturer", normalizedName: "Manufacturer" },
        { label: "Series", normalizedName: "Series" },
        { label: "Packaging", normalizedName: "Packaging" },
        { label: "Product Status", normalizedName: "Product Status" },
        { label: "Output Configuration", normalizedName: "Output Configuration" },
        { label: "Output Type", normalizedName: "Output Type" },
        { label: "Number of Regulators", normalizedName: "Number of Regulators" },
        { label: "Voltage - Input (Max)", normalizedName: "Voltage - Input (Max)" },
        { label: "Voltage - Output (Min/Fixed)", normalizedName: "Voltage - Output (Min/Fixed)" },
        { label: "Voltage - Output (Max)", normalizedName: "Voltage - Output (Max)" },
        { label: "Voltage Dropout (Max)", normalizedName: "Voltage Dropout (Max)" },
        { label: "Current - Output", normalizedName: "Current - Output" },
        { label: "Current - Quiescent (Iq)", normalizedName: "Current - Quiescent (Iq)" },
        { label: "Current - Supply (Max)", normalizedName: "Current - Supply (Max)" },
        { label: "PSRR", normalizedName: "PSRR" },
        { label: "Control Features", normalizedName: "Control Features" },
        { label: "Protection Features", normalizedName: "Protection Features" },
        { label: "Operating Temperature", normalizedName: "Operating Temperature" },
        { label: "Grade", normalizedName: "Grade" },
        { label: "Qualification", normalizedName: "Qualification" },
        { label: "Mounting Type", normalizedName: "Mounting Type" },
        { label: "Package / Case", normalizedName: "Package / Case" },
        { label: "Supplier Device Package", normalizedName: "Supplier Device Package" }
      ]
    }
  ]
};

export async function loadDigikeyTaxonomy(): Promise<DigikeyTaxonomySource> {
  try {
    const generated = (await import("@/lib/generated/digikey-taxonomy.json")).default as DigikeyTaxonomySource;
    if (generated?.source === "digikey" && Array.isArray(generated.categories) && generated.categories.length > 0) {
      return generated;
    }
  } catch {
    return fallbackTaxonomy;
  }

  return fallbackTaxonomy;
}

export function matchDigikeyCategory(text: string, taxonomy: DigikeyTaxonomySource) {
  const normalized = text.toLowerCase();

  let bestMatch: DigikeyCategoryTemplate | null = null;
  let bestScore = 0;

  for (const category of taxonomy.categories) {
    const matchedSignals = category.matchSignals.filter((signal) => normalized.includes(signal.toLowerCase()));
    const score = matchedSignals.reduce((total, signal) => total + (signal.length >= 12 ? 2 : 1), 0);

    if (matchedSignals.length === 0) continue;
    if (score < 2) continue;

    if (score > bestScore) {
      bestMatch = category;
      bestScore = score;
    }
  }

  return bestMatch;
}
