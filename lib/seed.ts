export const analysisSeeds = [
  {
    match: "upf5755",
    summary:
      "UPF5755 是一颗 5.15 to 5.85GHz 802.11ax WiFi Front End Module，第一页即可确认它面向 5GHz WLAN 前端集成场景，包含 PA、SPDT 和带 bypass 的 LNA。",
    review:
      "基于 UPMicro datasheet 首页信息，这颗器件更像高集成 5GHz WLAN FEM，首轮评估应优先确认发射功率档位、线性度条件和 16-pin LGA 封装约束。",
    keyParameters: [
      { name: "Frequency range", value: "5.15 to 5.85GHz", evidenceId: "ev-upf-frequency", status: "confirmed" },
      { name: "Output power", value: "17.0dBm to 22.0dBm", evidenceId: "ev-upf-power", status: "needs_review" },
      { name: "Integrated blocks", value: "5GHz PA + SPDT + LNA", evidenceId: "ev-upf-blocks", status: "confirmed" },
      { name: "Package", value: "LGA 3mm x 3mm x 0.55mm", evidenceId: "ev-upf-package", status: "needs_review" }
    ],
    evidence: [
      {
        id: "ev-upf-frequency",
        label: "频段范围",
        page: 1,
        quote: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        rect: { left: 8, top: 8, width: 56, height: 8 }
      },
      {
        id: "ev-upf-power",
        label: "发射功率档位",
        page: 1,
        quote: "17.0dBm / 21.0dBm / 22.0dBm output power",
        rect: { left: 52, top: 21, width: 28, height: 14 }
      },
      {
        id: "ev-upf-blocks",
        label: "集成功能块",
        page: 1,
        quote: "Integrated a 5GHz PA, a SPDT, a LNA with bypass",
        rect: { left: 50, top: 35, width: 32, height: 12 }
      },
      {
        id: "ev-upf-package",
        label: "封装规格",
        page: 1,
        quote: "LGA 3mm x 3mm x 0.55mm; 16-pin configuration",
        rect: { left: 50, top: 47, width: 31, height: 10 }
      }
    ]
  },
  {
    match: "sky85755-11",
    summary:
      "SKY85755-11 是一颗 5 GHz WLAN Front-End Module，第一页明确给出它集成 5GHz PA、带 bypass 的 LNA 以及单刀双掷收发开关，适合做 802.11ax 前端模块快速筛选。",
    review:
      "基于 Skyworks datasheet 首页信息，这颗器件的首轮评估重点应放在 32 dB 发射增益、13 dB 接收增益、发射功率档位以及 16-pin MSL1 封装约束。",
    keyParameters: [
      { name: "Category", value: "5 GHz WLAN Front-End Module", evidenceId: "ev-sky-category", status: "confirmed" },
      { name: "Transmit gain", value: "32 dB", evidenceId: "ev-sky-tx", status: "confirmed" },
      { name: "Receive gain", value: "13 dB", evidenceId: "ev-sky-rx", status: "confirmed" },
      { name: "Package", value: "QFN 3mm x 3mm, 16-pin", evidenceId: "ev-sky-package", status: "needs_review" }
    ],
    evidence: [
      {
        id: "ev-sky-category",
        label: "器件定位",
        page: 1,
        quote: "SKY85755-11: 5 GHz WLAN Front-End Module",
        rect: { left: 7, top: 8, width: 55, height: 8 }
      },
      {
        id: "ev-sky-tx",
        label: "发射增益",
        page: 1,
        quote: "Transmit gain: 32 dB",
        rect: { left: 7, top: 34, width: 24, height: 8 }
      },
      {
        id: "ev-sky-rx",
        label: "接收增益",
        page: 1,
        quote: "Receive gain: 13 dB",
        rect: { left: 7, top: 41, width: 24, height: 8 }
      },
      {
        id: "ev-sky-package",
        label: "封装规格",
        page: 1,
        quote: "Small QFN package (MSL1), 3 x 3 mm",
        rect: { left: 7, top: 49, width: 28, height: 11 }
      }
    ]
  },
  {
    match: "lmr51430",
    summary:
      "LMR51430 是一颗面向通用降压场景的 36V 输入同步降压稳压器，第一眼应优先核对输入范围、输出电流和热设计余量。",
    review:
      "基于当前 datasheet 的第一轮工程判断，这颗芯片适合做单路降压电源的快速筛选，但封装散热和推荐工作条件边界需要优先复核。",
    keyParameters: [
      { name: "Input voltage", value: "4.5V to 36V", evidenceId: "ev-input", status: "confirmed" },
      { name: "Output current", value: "Up to 3A", evidenceId: "ev-current", status: "confirmed" },
      { name: "Switching frequency", value: "Up to 2.1MHz", evidenceId: "ev-frequency", status: "confirmed" },
      { name: "Package", value: "SOT-23-THN", evidenceId: "ev-package", status: "needs_review" }
    ],
    evidence: [
      {
        id: "ev-summary",
        label: "产品定位与特性概览",
        page: 1,
        quote: "36-V, 3-A synchronous buck converter",
        rect: { left: 14, top: 18, width: 46, height: 10 }
      },
      {
        id: "ev-input",
        label: "输入电压范围",
        page: 4,
        quote: "VIN operating range 4.5 V to 36 V",
        rect: { left: 18, top: 30, width: 42, height: 9 }
      },
      {
        id: "ev-current",
        label: "输出电流",
        page: 1,
        quote: "3-A output current",
        rect: { left: 16, top: 26, width: 34, height: 8 }
      },
      {
        id: "ev-frequency",
        label: "开关频率",
        page: 7,
        quote: "Programmable switching frequency up to 2.1 MHz",
        rect: { left: 20, top: 38, width: 50, height: 9 }
      },
      {
        id: "ev-package",
        label: "封装与热设计",
        page: 24,
        quote: "Package options and thermal metrics",
        rect: { left: 24, top: 48, width: 38, height: 11 }
      }
    ]
  }
] as const;
