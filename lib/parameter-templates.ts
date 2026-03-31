import type { ParameterTemplate } from "@/lib/types";

const parameterTemplates: Record<string, ParameterTemplate> = {
  wifi: {
    id: "wifi",
    label: "Wi-Fi",
    deviceClass: "Wi-Fi",
    focusAreas: [
      "Frequency coverage",
      "TX linear output power",
      "RX gain / noise figure / bypass loss",
      "Control truth table",
      "Supply voltage",
      "Package / layout"
    ],
    fields: [
      { name: "RF Type", description: "器件面向的无线制式" },
      { name: "Frequency Coverage", description: "2.4GHz、5GHz 或 6GHz 等工作频段覆盖范围" },
      { name: "TX Linear Output Power", description: "满足 EVM 条件的发射线性输出能力" },
      { name: "EVM / ACLR Condition", description: "线性输出对应的 modulation、bandwidth 和测试条件" },
      { name: "RX Gain / Noise Figure / Bypass Loss", description: "接收路径增益、噪声系数以及 bypass 模式损耗" },
      { name: "Control Mode / Truth Table", description: "TX、RX、bypass 等模式切换逻辑与控制真值表" },
      { name: "Supply Voltage", description: "工作电源和关键供电条件" },
      { name: "Package / Case", description: "封装与尺寸" }
    ]
  },
  power: {
    id: "power",
    label: "Power",
    deviceClass: "Power",
    focusAreas: ["Input voltage", "Output current", "Switching frequency", "Package"],
    fields: [
      { name: "Voltage - Input (Min)", description: "最小输入电压" },
      { name: "Voltage - Input (Max)", description: "最大输入电压" },
      { name: "Current - Output", description: "输出电流能力" },
      { name: "Frequency - Switching", description: "开关频率" }
    ]
  },
  audio: {
    id: "audio",
    label: "Audio",
    deviceClass: "Audio",
    focusAreas: ["Output power", "THD+N", "SNR", "Package"],
    fields: [
      { name: "Current - Output", description: "输出驱动能力或功放功率相关能力" },
      { name: "Features", description: "音频能力、失真、增益或接口特性" },
      { name: "Voltage - Input (Max)", description: "电源或工作电压上限" },
      { name: "Supplier Device Package", description: "封装形式" }
    ]
  },
  "rf-general": {
    id: "rf-general",
    label: "RF General",
    deviceClass: "RF",
    focusAreas: [
      "Frequency range / bands",
      "Linear output power",
      "Gain / noise figure / isolation",
      "Control interface / timing",
      "Supply / current",
      "Package / thermal / layout"
    ],
    fields: [
      { name: "Device Role", description: "器件在 RF 链路中的角色，如 PA、LNA、FEM、switch 或 transceiver" },
      { name: "Frequency Range / Supported Bands", description: "工作频率范围或支持频段" },
      { name: "Output Power / Linear Output Power", description: "输出功率，优先记录满足线性度条件的线性输出能力" },
      { name: "Gain / Insertion Loss / Noise Figure / Isolation", description: "增益、插损、噪声系数、隔离度等关键 RF 指标" },
      { name: "Control Interface / Truth Table / Switching Time", description: "控制接口、模式映射、真值表和切换时序" },
      { name: "Supply Voltage / Current Consumption", description: "工作电压、电流消耗和供电条件" },
      { name: "Package / Thermal / Layout", description: "封装、散热、接地和布局要求" }
    ]
  },
  "cellular-3g4g5g": {
    id: "cellular-3g4g5g",
    label: "Cellular 3G/4G/5G",
    deviceClass: "Cellular PAM / PA",
    focusAreas: ["Bands", "Bandwidth", "Linear power", "ACLR/EVM", "RFFE", "Current", "VCC", "Package"],
    fields: [
      { name: "Supported bands", description: "支持制式和频段" },
      { name: "Bandwidth Capability", description: "支持的带宽能力，如 100MHz 或载波聚合条件" },
      { name: "Maximum Linear Output Power", description: "满足 ACLR/EVM 条件下的线性输出功率" },
      { name: "ACLR / EVM Condition", description: "对应线性功率的调制、带宽与线性度条件" },
      { name: "RFFE bus", description: "RFFE / MIPI 接口与控制能力" },
      { name: "Current Consumption", description: "关键 band 或 HPUE 模式下的电流消耗" },
      { name: "VCC / Supply", description: "APT/ET 相关供电电压或电源条件" },
      { name: "Package", description: "封装尺寸" }
    ]
  },
  "generic-fallback": {
    id: "generic-fallback",
    label: "Generic fallback",
    deviceClass: "Generic",
    focusAreas: ["Identity", "Electrical summary", "Package"],
    fields: [
      { name: "Category", description: "粗分类" },
      { name: "Input voltage", description: "输入电压" },
      { name: "Output current", description: "输出/驱动能力" },
      { name: "Package", description: "封装" }
    ]
  },
  "serial-flash": {
    id: "serial-flash",
    label: "Serial Flash",
    deviceClass: "Serial NOR Flash",
    focusAreas: [
      "Memory density / organization",
      "SPI / Dual / Quad / QPI interface",
      "Clock frequency / access performance",
      "Supply / current",
      "Erase / program architecture",
      "Protection / package"
    ],
    fields: [
      { name: "Technology / Memory Type", description: "如 NOR、Non-Volatile、Serial Flash 等技术归类" },
      { name: "Memory Size / Density", description: "容量，如 128Mbit" },
      { name: "Organization", description: "存储组织方式，如 x8、page / sector / block 结构" },
      { name: "Interface / I/O Mode", description: "SPI、Dual SPI、Quad SPI、QPI 等接口模式" },
      { name: "Max Clock Frequency", description: "最高时钟或接口速率" },
      { name: "Supply Voltage", description: "工作电压范围" },
      { name: "Active / Power-Down Current", description: "读写工作电流与掉电电流" },
      { name: "Page / Sector / Block Architecture", description: "页大小、扇区大小、块大小与擦除粒度" },
      { name: "Program / Erase Time", description: "页编程时间与扇区/块擦除时间" },
      { name: "Protection / Security Features", description: "写保护、OTP、Unique ID、reset / suspend 等安全特性" },
      { name: "Operating Temperature", description: "工作温度范围" },
      { name: "Package / Case", description: "封装形式" }
    ]
  },
  ldo: {
    id: "ldo",
    label: "LDO",
    deviceClass: "Power",
    focusAreas: ["Dropout", "Input voltage", "Output voltage", "Package"],
    fields: [
      { name: "Output Type", description: "固定或可调" },
      { name: "Voltage - Input (Max)", description: "最大输入电压" },
      { name: "Voltage - Output (Min/Fixed)", description: "输出电压下限/固定值" },
      { name: "Voltage Dropout (Max)", description: "压差" }
    ]
  },
  "wlan-fem": {
    id: "wifi",
    label: "Wi-Fi",
    deviceClass: "Wi-Fi",
    focusAreas: [
      "Frequency coverage",
      "TX linear output power",
      "RX gain / noise figure / bypass loss",
      "Control truth table",
      "Supply voltage",
      "Package / layout"
    ],
    fields: [
      { name: "RF Type", description: "器件面向的无线制式" },
      { name: "Frequency Coverage", description: "2.4GHz、5GHz 或 6GHz 等工作频段覆盖范围" },
      { name: "TX Linear Output Power", description: "满足 EVM 条件的发射线性输出能力" },
      { name: "EVM / ACLR Condition", description: "线性输出对应的 modulation、bandwidth 和测试条件" },
      { name: "RX Gain / Noise Figure / Bypass Loss", description: "接收路径增益、噪声系数以及 bypass 模式损耗" },
      { name: "Control Mode / Truth Table", description: "TX、RX、bypass 等模式切换逻辑与控制真值表" },
      { name: "Supply Voltage", description: "工作电源和关键供电条件" },
      { name: "Package / Case", description: "封装与尺寸" }
    ]
  },
  "dc-dc": {
    id: "power",
    label: "Power",
    deviceClass: "Power",
    focusAreas: ["Input voltage", "Output current", "Switching frequency", "Package"],
    fields: [
      { name: "Voltage - Input (Min)", description: "最小输入电压" },
      { name: "Voltage - Input (Max)", description: "最大输入电压" },
      { name: "Current - Output", description: "输出电流能力" },
      { name: "Frequency - Switching", description: "开关频率" }
    ]
  },
  "cellular-pam": {
    id: "cellular-3g4g5g",
    label: "Cellular 3G/4G/5G",
    deviceClass: "Cellular PAM / PA",
    focusAreas: ["Bands", "Bandwidth", "Linear power", "ACLR/EVM", "RFFE", "Current", "VCC", "Package"],
    fields: [
      { name: "Supported bands", description: "支持制式和频段" },
      { name: "Bandwidth Capability", description: "支持的带宽能力，如 100MHz 或载波聚合条件" },
      { name: "Maximum Linear Output Power", description: "满足 ACLR/EVM 条件下的线性输出功率" },
      { name: "ACLR / EVM Condition", description: "对应线性功率的调制、带宽与线性度条件" },
      { name: "RFFE bus", description: "RFFE / MIPI 接口与控制能力" },
      { name: "Current Consumption", description: "关键 band 或 HPUE 模式下的电流消耗" },
      { name: "VCC / Supply", description: "APT/ET 相关供电电压或电源条件" },
      { name: "Package", description: "封装尺寸" }
    ]
  },
  fallback: {
    id: "generic-fallback",
    label: "Generic fallback",
    deviceClass: "Generic",
    focusAreas: ["Identity", "Electrical summary", "Package"],
    fields: [
      { name: "Category", description: "粗分类" },
      { name: "Input voltage", description: "输入电压" },
      { name: "Output current", description: "输出/驱动能力" },
      { name: "Package", description: "封装" }
    ]
  }
};

export function getParameterTemplate(templateId: string | null | undefined): ParameterTemplate {
  if (!templateId) {
    return parameterTemplates["generic-fallback"];
  }

  return parameterTemplates[templateId] ?? parameterTemplates["generic-fallback"];
}

export function listParameterTemplates() {
  return Object.values(parameterTemplates);
}
