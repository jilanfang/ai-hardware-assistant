import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getParameterTemplate } from "@/lib/parameter-templates";
import { GeminiLlmProvider, OpenAiLlmProvider } from "@/lib/real-provider";
import type { DocumentPreparation } from "@/lib/types";

vi.mock("@/lib/pdf-images", () => ({
  renderPdfPagesToImages: vi.fn(async () => [{ page: 1, dataUrl: "data:image/png;base64,ZmFrZQ==" }])
}));

import { renderPdfPagesToImages } from "@/lib/pdf-images";

const fetchMock = vi.fn();

function createPreparation(overrides: Partial<DocumentPreparation> = {}): DocumentPreparation {
  return {
    identityCandidates: {
      sku: "W25Q128FVSIG",
      manufacturer: "Winbond",
      documentTitle: "3V 128M-BIT SERIAL FLASH MEMORY WITH DUAL/QUAD SPI & QPI",
      aliases: []
    },
    documentMeta: {
      fileName: "W25Q128FVSIG.pdf",
      pageCount: 99,
      textCoverage: 42,
      extractionMethod: "none"
    },
    pagePackets: [
      {
        page: 1,
        text: "Winbond W25Q128FV 3V 128M-BIT SERIAL FLASH MEMORY WITH DUAL/QUAD SPI & QPI",
        sectionHints: ["cover", "features"],
        isHardPage: true
      }
    ],
    localCandidates: [
      {
        name: "Package",
        value: "WSON-8 and TFBGA",
        page: 1,
        quote: "Packages WSON-8 and TFBGA",
        confidence: 0.92
      }
    ],
    complexityFlags: {
      twoColumn: false,
      tableHeavy: false,
      imageHeavy: false,
      watermarkHeavy: true,
      crossPageTableLikely: false,
      lowTextReliability: true
    },
    ...overrides
  };
}

describe("OpenAiLlmProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test("normalizes alternate identity schema returned by multimodal models", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                parameterTemplateId: "generic-fallback",
                deviceIdentity: {
                  sku: "W25Q128FV",
                  manufacturer: "Winbond",
                  documentTitle: "3V 128M-BIT SERIAL FLASH MEMORY WITH DUAL/QUAD SPI & QPI"
                },
                nextStep: "Read the feature list first."
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "qwen3-vl-32b-instruct",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation();

    const result = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "W25Q128FVSIG.pdf",
      taskName: "W25Q128FVSIG",
      chipName: "W25Q128FVSIG",
      preparation,
      publicContext: []
    });

    expect(result).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "W25Q128FV",
        manufacturer: "Winbond",
        deviceClass: expect.stringContaining("FLASH"),
        parameterTemplateId: "generic-fallback",
        focusChecklist: expect.arrayContaining(["Read the feature list first."]),
        confidence: expect.any(Number)
      })
    );
  });

  test("normalizes gemini-style identity schema returned by multimodal models", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                identity: {
                  sku: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  type: "WiFi Front End Module (FEM)",
                  description: "一款高度集成的5GHz射频前端模块。"
                },
                parameterTemplateId: "wifi"
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const result = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      publicContext: []
    });

    expect(result).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        deviceClass: "WiFi Front End Module (FEM)",
        parameterTemplateId: "wifi",
        confidence: expect.any(Number)
      })
    );
  });

  test("uses responses api with input_file pdf for gpt-4o instead of rendering images", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  part: "UPF5755",
                  manufacturer: "UPMicro",
                  kind: "WiFi Front End Module",
                  parameterTemplateId: "wifi"
                })
              }
            ]
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gpt-4o",
      baseUrl: "https://example.com"
    });
    const renderMock = vi.mocked(renderPdfPagesToImages);
    const renderCallCountBefore = renderMock.mock.calls.length;

    const result = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(result).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi"
      })
    );
    expect(renderMock.mock.calls.length).toBe(renderCallCountBefore);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1/responses");
    const body = JSON.parse(String(init?.body ?? "{}"));
    expect(body.input?.[0]?.content?.some((part: { type?: string }) => part.type === "input_file")).toBe(true);
  });

  test("normalizes teaching-style report payloads and falls back to local datasheet evidence", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                teachingReport: {
                  deviceIdentity: {
                    canonicalPartNumber: "W25Q128FV",
                    manufacturer: "Winbond",
                    deviceClass: "Serial Flash Memory",
                    primaryFunction: "Non-volatile flash memory for firmware and configuration storage.",
                    applicationContext: "Used in MCU and embedded systems."
                  },
                  readingSkeleton: {
                    step1: {
                      instruction: "Confirm identity and use case.",
                      currentProgress: "Already identified from the cover page.",
                      nextAction: "Read the feature list and electrical characteristics."
                    },
                    step2: {
                      instruction: "Read the feature list before long tables.",
                      currentProgress: "Need to inspect the next page.",
                      nextAction: "Verify interface modes and voltage range."
                    }
                  },
                  parameterTable: {
                    rows: [["Electrical", "VCC", "3.0", "2.7", "3.6", "TA=25C", "Estimated from generic memory family"]],
                    notes: ["These values need datasheet confirmation."]
                  },
                  riskTable: {
                    rows: [["Electrical", "Supply margin is narrow.", "Power issues can break operation.", "Stabilize the rail."]]
                  },
                  glossaryForJuniors: {
                    SPI: "Serial Peripheral Interface"
                  },
                  openQuestions: ["Need the exact timing table."],
                  sectionBySectionReadingOrder: ["Cover page", "Feature list", "Electrical characteristics"]
                }
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "qwen3-vl-32b-instruct",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation();

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "W25Q128FVSIG.pdf",
      taskName: "W25Q128FVSIG",
      chipName: "W25Q128FVSIG",
      preparation,
      identity: {
        canonicalPartNumber: "W25Q128FV",
        manufacturer: "Winbond",
        deviceClass: "Serial Flash Memory",
        parameterTemplateId: "generic-fallback",
        focusChecklist: ["Voltage range", "Interface modes"],
        publicContext: [],
        confidence: 0.88
      },
      parameterTemplate: getParameterTemplate("generic-fallback"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("W25Q128FV");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "W25Q128FV",
        manufacturer: "Winbond",
        deviceClass: "Serial Flash Memory",
        parameterTemplateId: "generic-fallback"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Package",
          value: "WSON-8 and TFBGA",
          sourceType: "datasheet",
          citations: [expect.objectContaining({ page: 1, quote: "Packages WSON-8 and TFBGA" })]
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Electrical",
          sourceType: "review"
        })
      ])
    );
    expect(report.openQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Need the exact timing table.",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "section_by_section_reading_order",
        "critical_graphs_and_tables",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini-style teaching report payloads for complex pdfs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceIdentification: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi 6 (802.11ax) 5GHz Front End Module (FEM)",
                  primaryFunction: "集成 5GHz 功率放大器 (PA)、低噪声放大器 (LNA) 及开关 (SPDT)，用于增强 Wi-Fi 射频信号的发射功率和接收灵敏度。",
                  applicationScenarios: ["802.11ax 网络及个人电脑系统", "支持 WLAN 的无线视频系统"]
                },
                quickStartGuide: [
                  {
                    step: 1,
                    task: "确认频率范围",
                    focus: "首页标题",
                    rationale: "确保覆盖 5.15GHz 到 5.85GHz 全频段。"
                  },
                  {
                    step: 2,
                    task: "研究功能框图",
                    focus: "RX/TX 路径切换",
                    rationale: "识别 LNA、PA 和 SPDT 开关。"
                  }
                ],
                keyParameters: [
                  {
                    parameter: "Frequency Range",
                    value: "5.15 - 5.85 GHz",
                    unit: "GHz",
                    engineeringSignificance: "涵盖标准的 5GHz WiFi 频段。",
                    datasource: "page 1"
                  }
                ],
                engineeringInterpretation: {
                  absoluteMaxVsRecommended: {
                    explanation: "Absolute Max 不是推荐工作条件。",
                    impact: "超过推荐范围会缩短寿命。"
                  },
                  testConditionsCaveats: {
                    explanation: "RF 参数依赖 VCC=5.0V, TA=25℃。",
                    impact: "电源跌落会恶化 EVM 指标。"
                  },
                  terminologyExplanations: [
                    {
                      term: "FEM",
                      definition: "Front End Module，集成射频前端关键器件。"
                    }
                  ]
                },
                risksAndGotchas: [
                  {
                    type: "Thermal & Grounding",
                    risk: "中心散热焊盘焊接不良。",
                    impact: "会导致 PA 热漂移甚至烧毁。",
                    mitigation: "PCB Layout 必须布置足够的散热过孔。"
                  }
                ],
                nextSteps: [
                  {
                    action: "核对逻辑电平",
                    description: "检查 SoC GPIO 是否在 VCTLH 范围内。"
                  }
                ],
                openQuestions: [
                  {
                    question: "LNA Bypass 模式下的具体 Noise Figure 是多少？",
                    status: "手册未明确给出。",
                    impact: "强信号场景的灵敏度评估受限。"
                  }
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 - 5.85 GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Thermal & Grounding",
          sourceType: "review"
        })
      ])
    );
    expect(report.openQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "LNA Bypass 模式下的具体 Noise Figure 是多少？",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "section_by_section_reading_order",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "open_questions",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes alternate gemini teaching report payloads returned from sparse-page direct reading", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceIdentity: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi 6 (802.11ax) Front End Module (FEM)",
                  shortDescription: "集成 PA、LNA（带 bypass）和 SPDT 开关的 5GHz 射频前端模组。"
                },
                readingStrategy: {
                  recommendedOrder: [
                    {
                      section: "Functional Block Diagram",
                      purpose: "理解信号流向。"
                    },
                    {
                      section: "RF Performance Tables",
                      purpose: "对比不同协议下的增益、NF 和电流。"
                    }
                  ],
                  engineeringTerms: [
                    {
                      term: "FEM",
                      explanation: "Front End Module。"
                    }
                  ]
                },
                keyParameters: [
                  {
                    parameter: "Frequency Range",
                    value: "5.15 GHz to 5.85 GHz",
                    engineeringSignificance: "覆盖 5G Wi-Fi 全频段。",
                    citation: "page 1, Header"
                  }
                ],
                risksAndGotchas: [
                  {
                    type: "Thermal Risk",
                    description: "底部焊盘散热不足。",
                    impact: "长期运行可靠性风险。"
                  }
                ],
                engineeringJudgment: {
                  absoluteMaximumVsRecommended: "Absolute Maximum 是毁坏极限。",
                  typicalVsGuaranteed: "Typical 不等于 guaranteed。",
                  testConditionsImportance: "所有 RF 参数都必须带条件看。"
                },
                nextStepsForIntern: [
                  "查找 Control Logic 表格，记录 Ctrl0/Ctrl1 的高低电平值。",
                  "查找 LNA On 和 Bypass 两种状态下的 NF 数值。"
                ],
                publicNotes: ""
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 GHz to 5.85 GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Thermal Risk",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "section_by_section_reading_order",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini instructional report payloads with parameter and risk tables", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceIdentification: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi 6 (802.11ax) Front End Module (FEM)",
                  shortDescription: "集成 PA、LNA（带 Bypass）和 SPDT 开关的 5GHz 高性能 WiFi 射频前端模块。"
                },
                instructionalReport: {
                  what_this_part_is_for: "UPF5755 是 Wi-Fi 芯片组与天线之间的射频前端模组。",
                  reading_sequence: [
                    "第一步：看首页标题确认频段和协议。",
                    "第二步：分析 Functional Block Diagram。"
                  ],
                  key_parameters: [
                    {
                      parameter: "Frequency Range",
                      value: "5.15 to 5.85 GHz",
                      engineeringSignificance: "覆盖主流 5GHz Wi-Fi 频段。"
                    }
                  ],
                  risks_and_gotchas: [
                    {
                      type: "测试条件误读",
                      description: "Pout 参数必须对应具体调制方式。"
                    }
                  ],
                  terminology_definitions: {
                    FEM: "Front End Module。",
                    DEVM: "动态误差矢量幅度。"
                  },
                  next_steps_for_intern: [
                    "查找 Control Logic Truth Table。",
                    "核对 Recommended Operating Conditions。"
                  ]
                },
                parameterTable: {
                  frequency_range: "5.15 - 5.85 GHz (review)",
                  operating_voltage: "5.0 V (page 1)"
                },
                riskAssessmentTable: [
                  {
                    riskItem: "电源纹波敏感度",
                    impactSeverity: "中",
                    mitigationStrategy: "VCC 引脚靠近放置去耦电容。"
                  }
                ],
                publicNotes: ""
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "测试条件误读",
          sourceType: "review"
        }),
        expect.objectContaining({
          label: "电源纹波敏感度",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "section_by_section_reading_order",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini device overview payloads with parameter table and risk analysis", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                device_overview: {
                  manufacturer: "Smarter Micro",
                  part_number: "S55643-51Q",
                  device_class: "NR MMMB PAM for NR/LTE/3G",
                  what_it_is_for: "一颗面向蜂窝通信前端的功率放大模块。"
                },
                how_to_read_this_datasheet: {
                  reading_order: [
                    "先看首页确认支持频段、工艺和封装。",
                    "再看功能框图和 MIPI 控制接口定义。"
                  ],
                  junior_tips: [
                    "Electrical Characteristics 必须结合 test condition 一起看。",
                    "重点区分线性输出功率和饱和输出功率。"
                  ]
                },
                critical_graphs_and_tables: [
                  "Band support summary",
                  "Power vs EVM tables"
                ],
                parameter_table: {
                  supported_bands: "n77/n78/n79/LB/HB",
                  max_linear_power_n41: "27.5 dBm",
                  mipi_version: "v2.1",
                  mipi_clock_speed: "26 MHz",
                  package_size: "5 x 7 mm"
                },
                risk_analysis: [
                  {
                    risk: "MIPI 时序理解错误",
                    impact: "上电后模式配置失败"
                  },
                  {
                    risk: "Band 功率表读取错列",
                    impact: "链路预算判断失真"
                  }
                ],
                intern_action_list: {
                  immediate_tasks: [
                    "核对 band mapping 和目标项目频段是否一致。",
                    "整理 Pout/EVM 条件下的功耗。"
                  ],
                  long_term_growth: [
                    "熟悉 PAM 线性度指标与 ACLR/EVM 的关系。"
                  ]
                },
                open_questions: [
                  "不同 band 下的效率曲线是否完整给出？"
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "S55643-51Q",
        manufacturer: "Smarter Micro",
        documentTitle: "AgiPAMTM NR MMMB PAM for NR/LTE/3G",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q",
      chipName: "S55643-51Q",
      preparation,
      identity: {
        canonicalPartNumber: "S55643-51Q",
        manufacturer: "Smarter Micro",
        deviceClass: "NR MMMB PAM for NR/LTE/3G",
        parameterTemplateId: "cellular-3g4g5g",
        focusChecklist: ["band support", "linear output power", "MIPI control"],
        publicContext: [],
        confidence: 0.82
      },
      parameterTemplate: getParameterTemplate("cellular-3g4g5g"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("S55643-51Q");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "S55643-51Q",
        manufacturer: "Smarter Micro",
        parameterTemplateId: "cellular-3g4g5g"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "supported bands",
          value: "n77/n78/n79/LB/HB",
          sourceType: "review"
        }),
        expect.objectContaining({
          label: "max linear power n41",
          value: "27.5 dBm",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "MIPI 时序理解错误",
          sourceType: "review"
        })
      ])
    );
    expect(report.openQuestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "不同 band 下的效率曲线是否完整给出？",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "critical_graphs_and_tables",
        "risks_and_gotchas",
        "intern_action_list",
        "open_questions"
      ])
    );
  });

  test("normalizes gemini deviceInfo payloads returned by real UPF5755 runs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceInfo: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi Front End Module (FEM)",
                  shortDescription:
                    "高性能 5GHz 802.11ax (Wi-Fi 6) 射频前端模块，集成 PA、LNA（带 Bypass）及 SPDT 开关。",
                  datasheetVersion: "V1.2"
                },
                instructionalGuide: {
                  what_this_part_is_for:
                    "UPF5755 是 Wi-Fi 设备射频链路的最末端，负责放大发射功率、放大接收信号并切换天线路径。",
                  how_to_read_this_datasheet: [
                    "先看首页确认频段、协议和集成模块。",
                    "再读功能框图和控制逻辑。"
                  ],
                  key_parameters: [
                    {
                      parameter: "Frequency Range",
                      value: "5.15 - 5.85 GHz",
                      explanation: "覆盖 5GHz Wi-Fi 频段。"
                    },
                    {
                      parameter: "TX Performance",
                      value: "17.0dBm @ -43dB DEVM (HE160, MCS11)",
                      explanation: "判断线性输出能力。"
                    }
                  ],
                  risks_and_gotchas: [
                    "必须区分 Absolute Maximum Ratings 和 Recommended Operating Conditions。",
                    "RF 表格必须结合具体 modulation / test condition 解读。"
                  ],
                  next_steps: [
                    "核对 RX bypass 模式下的增益与线性度。",
                    "检查布局对散热焊盘和去耦的要求。"
                  ]
                },
                parameterTable: {
                  "RF Type": "802.11ax (Wi-Fi 6) 5GHz",
                  "Frequency Range": "5.15 - 5.85 GHz",
                  "Supply Voltage (VCC)": "5.0V (Typical)",
                  Package: "LGA 16-pin, 3x3x0.55mm"
                },
                publicNotes: ""
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 - 5.85 GHz",
          sourceType: "review"
        }),
        expect.objectContaining({
          label: "RF Type",
          value: "802.11ax (Wi-Fi 6) 5GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Risk 1",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list"
      ])
    );
  });

  test("normalizes gemini snake_case payloads returned by real UPF5337 runs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                device_identification: {
                  canonical_part_number: "UPF5337",
                  manufacturer: "UPMicro (昂璞微)",
                  device_class: "Wi-Fi 2.4GHz Front End Module (FEM)",
                  summary:
                    "UPF5337 是一款高度集成的 2.4GHz 射频前端模块（FEM），支持 802.11ax (Wi-Fi 6) 协议。"
                },
                how_to_read_this_datasheet: {
                  reading_order: [
                    "先看首页确认频段、集成模块和应用场景。",
                    "再看功能框图与控制真值表。"
                  ],
                  terminology_definitions: [
                    {
                      term: "FEM",
                      definition: "Front End Module。"
                    }
                  ]
                },
                key_parameters: {
                  table_data: [
                    {
                      parameter: "Frequency Range",
                      value: "2.4 - 2.5 GHz",
                      significance: "确认应用频段。"
                    },
                    {
                      parameter: "Supply Voltage",
                      value: "5.0 V",
                      significance: "决定电源设计。"
                    }
                  ],
                  condition_warnings: [
                    "增益和线性度必须结合测试条件一起看。"
                  ]
                },
                risks_and_gotchas: {
                  table_data: [
                    {
                      risk: "测试条件误读",
                      implication: "可能高估线性输出能力。"
                    }
                  ]
                },
                next_steps: [
                  {
                    action: "核对控制逻辑",
                    detail: "确认 PA/LNA/BYPASS 模式切换。"
                  }
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5337",
        manufacturer: "UPMicro",
        documentTitle: "2.4GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5337 datasheet V1.1.pdf",
      taskName: "UPF5337",
      chipName: "UPF5337",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "tx power", "control logic"],
        publicContext: [],
        confidence: 0.9
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5337");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "2.4 - 2.5 GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "测试条件误读",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes RF parameter aliases into template-aligned wifi labels", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceInfo: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro",
                  deviceClass: "Wi-Fi Front End Module (FEM)"
                },
                instructionalGuide: {
                  what_this_part_is_for: "5GHz Wi-Fi FEM",
                  key_parameters: [
                    {
                      parameter: "Frequency Range",
                      value: "5.15 - 5.85 GHz",
                      explanation: "5GHz frequency coverage."
                    },
                    {
                      parameter: "Operating Voltage",
                      value: "5.0 V",
                      explanation: "Main supply."
                    },
                    {
                      parameter: "Truth Table",
                      value: "TX/RX/BYPASS modes supported",
                      explanation: "Control mode mapping."
                    },
                    {
                      parameter: "Noise Figure",
                      value: "2.5 dB typ",
                      explanation: "RX NF under receive path."
                    }
                  ]
                },
                parameterTable: {
                  "Frequency Range": "5.15 - 5.85 GHz",
                  "Operating Voltage": "5.0 V",
                  "Truth Table": "TX/RX/BYPASS modes supported",
                  "Noise Figure": "2.5 dB typ"
                }
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "UPF5755.pdf",
      taskName: "UPF5755 初步分析",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5GHz WiFi Front End Module",
          aliases: []
        }
      }),
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "tx power", "control logic"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 - 5.85 GHz"
        }),
        expect.objectContaining({
          label: "Supply Voltage",
          value: "5.0 V"
        }),
        expect.objectContaining({
          label: "Control Mode / Truth Table",
          value: "TX/RX/BYPASS modes supported"
        }),
        expect.objectContaining({
          label: "RX Gain / Noise Figure / Bypass Loss",
          value: "2.5 dB typ"
        })
      ])
    );
  });

  test("normalizes gemini device_identity payloads returned by real UPF5755 runs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                device_identity: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi Front End Module (FEM)",
                  description:
                    "这是一款专为 5GHz 频段 802.11ax (Wi-Fi 6) 设计的高性能射频前端模组，集成了 PA、LNA、SPDT 和 PDET。",
                  what_this_part_is_for:
                    "解决 Wi-Fi 设备在 5GHz 高频段下信号发射功率不足和接收灵敏度低的问题。"
                },
                how_to_read_this_datasheet: {
                  suggested_reading_order: [
                    "先看首页确认频段、协议和集成模块。",
                    "再读 RF Performance 表和 Truth Table。"
                  ],
                  jargon_briefing: {
                    FEM: "Front End Module",
                    PDET: "Power Detector"
                  }
                },
                key_parameters: [
                  {
                    name: "Frequency Coverage",
                    value: "5.15 - 5.85 GHz",
                    significance: "确认覆盖 5GHz Wi-Fi 频段。"
                  },
                  {
                    name: "Operating Voltage",
                    value: "5V (Typ.)",
                    significance: "决定电源设计。"
                  }
                ],
                risks_and_gotchas: [
                  {
                    risk: "测试条件误读",
                    detail: "EVM/Pout 必须绑定 modulation 和 bandwidth 看。"
                  }
                ],
                parameter_table: {
                  package: "16-pin LGA, 3.0 x 3.0 x 0.55 mm",
                  power_detector: "Integrated (PDET)"
                },
                next_steps: [
                  "查找 DC Electrical Characteristics，确认工作电压范围。",
                  "核对 Truth Table 的 Ctrl0/1 逻辑。"
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 - 5.85 GHz",
          sourceType: "review"
        }),
        expect.objectContaining({
          label: "package",
          value: "16-pin LGA, 3.0 x 3.0 x 0.55 mm",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "测试条件误读",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini camelCase partIdentity payloads returned by real UPF5337 runs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                partIdentity: {
                  canonicalPartNumber: "UPF5337",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi Front End Module (FEM)",
                  shortDescription:
                    "2.4GHz 802.11ax (Wi-Fi 6) 射频前端集成芯片，集成了功率放大器、低噪声放大器及天线开关。"
                },
                howToReadThisDatasheet: {
                  readingSequence: [
                    "先看首页确认频段和封装。",
                    "再读 RF Performance 与控制逻辑。"
                  ],
                  engineeringContext:
                    "在 802.11ax 时代，需要同时关注功率和线性度（EVM）。"
                },
                keyParameters: [
                  {
                    parameter: "Frequency",
                    value: "2.4GHz - 2.5GHz",
                    engineeringSignificance: "确认工作频段。"
                  }
                ],
                risksAndGotchas: [
                  {
                    type: "EVM 误读",
                    description: "不能只看输出功率，不看 DEVM 条件。"
                  }
                ],
                parameterTable: {
                  "RF Type": "802.11ax (Wi-Fi 6)",
                  "Package / Case": "QFN 3x3mm, 16-pad"
                },
                terminologyExplanation: [
                  {
                    term: "EVM",
                    definition: "误差矢量幅度，用于衡量调制质量。"
                  }
                ],
                nextSteps: [
                  "查阅电气特性表，确认 NF 和 Gain。",
                  "记录 Control Logic 真值表。"
                ],
                publicNotes: ""
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5337",
        manufacturer: "UPMicro",
        documentTitle: "2.4GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5337 datasheet V1.1.pdf",
      taskName: "UPF5337",
      chipName: "UPF5337",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "tx power", "control logic"],
        publicContext: [],
        confidence: 0.9
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5337");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "2.4GHz - 2.5GHz",
          sourceType: "review"
        }),
        expect.objectContaining({
          label: "RF Type",
          value: "802.11ax (Wi-Fi 6)",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "EVM 误读",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini deviceInfo payloads with parameterAnalysis tables", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deviceInfo: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Wi-Fi Front End Module (FEM)",
                  description:
                    "5.15 to 5.85GHz 802.11ax WiFi 前端模块，集成了 PA、LNA（带 bypass）和 SPDT 开关。",
                  applicationKeywords: ["802.11ax", "5GHz", "FEM"]
                },
                howToReadThisDatasheet: {
                  readingOrder: [
                    "先看首页确认频段和器件定位。",
                    "再读 RF performance 和控制逻辑。"
                  ],
                  keySections: ["Feature list", "RF performance", "Truth table"]
                },
                terminologyExplanation: [
                  {
                    term: "EVM",
                    explanation: "误差矢量幅度。"
                  }
                ],
                parameterAnalysis: {
                  table: [
                    {
                      parameter: "Frequency Range",
                      value: "5.15 - 5.85 GHz",
                      engineeringMeaning: "确认覆盖 5GHz Wi-Fi。"
                    },
                    {
                      parameter: "Operating Voltage",
                      value: "5V",
                      engineeringMeaning: "决定供电设计。"
                    }
                  ],
                  engineeringJudgment: [
                    "线性输出功率必须结合 DEVM 条件看。"
                  ]
                },
                risksAndGotchas: {
                  table: [
                    {
                      risk: "测试条件误读",
                      whyItMatters: "会高估实际链路性能。"
                    }
                  ]
                },
                nextSteps: [
                  {
                    action: "核对 NF/Gain",
                    detail: "查找 RX 模式下的噪声系数和增益。"
                  }
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "output power", "noise figure"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5755");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro (昂璞微)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "5.15 - 5.85 GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "测试条件误读",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("normalizes gemini device_identity payloads with key_parameters.parameters arrays", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                device_identity: {
                  manufacturer: "UPMicro (昂璞微电子)",
                  part_number: "UPF5337",
                  description:
                    "高度集成的 2.4GHz Wi-Fi 6 (802.11ax) 射频前端模块 (FEM)，内部集成 PA、带 Bypass 的 LNA、SPDT 和 PDET。",
                  application: "802.11ax 机顶盒、路由器和 PC 网卡。"
                },
                how_to_read_this_datasheet: {
                  reading_order: [
                    "先看首页确认频段和应用。",
                    "再看 RF 性能表和控制逻辑。"
                  ]
                },
                key_parameters: {
                  template_id: "wifi",
                  parameters: [
                    {
                      parameter: "Frequency Range",
                      value: "2.4 - 2.5 GHz",
                      significance: "确认应用频段。"
                    }
                  ]
                },
                engineering_terminology: [
                  {
                    term: "PDET",
                    definition: "Power Detector。"
                  }
                ],
                risks_and_gotchas: {
                  table: [
                    {
                      risk: "控制逻辑误读",
                      whyItMatters: "可能导致 TX/RX 模式切换错误。"
                    }
                  ]
                },
                next_steps_for_intern: [
                  "记录 Truth Table。",
                  "确认 LNA NF。"
                ],
                public_notes: ""
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5337",
        manufacturer: "UPMicro",
        documentTitle: "2.4GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5337 datasheet V1.1.pdf",
      taskName: "UPF5337",
      chipName: "UPF5337",
      preparation,
      identity: {
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range", "tx power", "control logic"],
        publicContext: [],
        confidence: 0.9
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toContain("UPF5337");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro (昂璞微电子)",
        parameterTemplateId: "wifi"
      })
    );
    expect(report.keyParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Frequency Coverage",
          value: "2.4 - 2.5 GHz",
          sourceType: "review"
        })
      ])
    );
    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "控制逻辑误读",
          sourceType: "review"
        })
      ])
    );
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "what_this_part_is_for",
        "how_to_read_this_datasheet",
        "key_parameters",
        "risks_and_gotchas",
        "intern_action_list",
        "glossary_for_juniors"
      ])
    );
  });

  test("repairs malformed report payloads with a second strict repair call", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  foo: "bar"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  executiveSummary: "UPF5755 repaired report",
                  deviceIdentity: {
                    canonicalPartNumber: "UPF5755",
                    manufacturer: "UPMicro (昂璞微)",
                    deviceClass: "Wi-Fi Front End Module (FEM)",
                    parameterTemplateId: "wifi",
                    confidence: 0.91
                  },
                  keyParameters: [],
                  designFocus: [],
                  risks: [],
                  openQuestions: [],
                  publicNotes: [],
                  citations: [],
                  sections: [
                    {
                      id: "device_identity",
                      title: "器件身份",
                      body: "UPMicro UPF5755",
                      sourceType: "review",
                      citations: []
                    }
                  ],
                  claims: []
                })
              }
            }
          ]
        })
      });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation: createPreparation(),
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(report.executiveSummary).toContain("repaired");
    expect(report.deviceIdentity).toEqual(
      expect.objectContaining({
        canonicalPartNumber: "UPF5755",
        parameterTemplateId: "wifi"
      })
    );
  });

  test("normalizes section ids into the fixed teaching report skeleton and backfills unknown deviceClass", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: "UPF5755 report",
                deviceIdentity: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  deviceClass: "Unknown",
                  parameterTemplateId: "wifi",
                  confidence: 0.88
                },
                keyParameters: [],
                designFocus: [],
                risks: [],
                openQuestions: [],
                publicNotes: [],
                citations: [],
                sections: [
                  {
                    id: "sec1",
                    title: "器件身份",
                    body: "UPF5755",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "sec2",
                    title: "怎么读这份 Datasheet",
                    body: "先看首页",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "sec3",
                    title: "风险与易错点",
                    body: "测试条件",
                    sourceType: "review",
                    citations: []
                  }
                ],
                claims: []
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation: createPreparation(),
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["frequency range"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.deviceIdentity.deviceClass).toBe("WiFi Front End Module");
    expect(report.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining([
        "device_identity",
        "how_to_read_this_datasheet",
        "risks_and_gotchas"
      ])
    );
    expect(report.sections.some((section) => section.id === "sec1")).toBe(false);
  });

  test("maps RF teaching-step titles and step ids into canonical section ids", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: "UPF5337 report",
                deviceIdentity: {
                  canonicalPartNumber: "UPF5337",
                  manufacturer: "UPMicro",
                  deviceClass: "Unknown",
                  parameterTemplateId: "wifi",
                  confidence: 0.86
                },
                keyParameters: [],
                designFocus: [],
                risks: [],
                openQuestions: [],
                publicNotes: [],
                citations: [],
                sections: [
                  {
                    id: "step_1",
                    title: "第一步：确定身份与用途",
                    body: "确认这是一颗 Wi-Fi FEM。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "step_2_features",
                    title: "第二步：关键特性解读",
                    body: "先看首页 feature list。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "step_3_block_diagram",
                    title: "第三步：理解内部结构",
                    body: "关注 TX/RX/LNA/PA 信号路径。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "step_4_limits",
                    title: "第四步：区分限制与推荐条件",
                    body: "不能把 absolute max 当推荐工作条件。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "step_5_rf",
                    title: "第五步：RF 参数的工程判断",
                    body: "区分线性输出与饱和输出。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "step_6_layout",
                    title: "第六步：物理落地风险",
                    body: "关注 layout、thermal 和控制接口。",
                    sourceType: "review",
                    citations: []
                  }
                ],
                claims: []
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5337 datasheet V1.1.pdf",
      taskName: "UPF5337",
      chipName: "UPF5337",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5337",
          manufacturer: "UPMicro",
          documentTitle: "Wi-Fi Front End Module",
          aliases: []
        }
      }),
      identity: {
        canonicalPartNumber: "UPF5337",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["feature list"],
        publicContext: [],
        confidence: 0.93
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.deviceIdentity.deviceClass).toBe("WiFi Front End Module");
    expect(report.sections.map((section) => section.id)).toEqual([
      "device_identity",
      "how_to_read_this_datasheet",
      "critical_graphs_and_tables",
      "risks_and_gotchas",
      "key_parameters",
      "risks_and_gotchas"
    ]);
    expect(report.sections.some((section) => /^step_|^sec/i.test(section.id))).toBe(false);
  });

  test("uses multi-page image inputs for cellular reports even when ODL is unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: "S55643-51Q report",
                deviceIdentity: {
                  canonicalPartNumber: "S55643-51Q",
                  manufacturer: "Smarter Micro",
                  deviceClass: "Cellular PAM / PA",
                  parameterTemplateId: "cellular-3g4g5g",
                  confidence: 0.92
                },
                keyParameters: [],
                designFocus: [],
                risks: [],
                openQuestions: [],
                publicNotes: [],
                citations: [],
                sections: [
                  {
                    id: "device_identity",
                    title: "器件身份",
                    body: "S55643-51Q",
                    sourceType: "review",
                    citations: []
                  }
                ],
                claims: []
              })
            }
          }
        ]
      })
    });

    const renderMock = vi.mocked(renderPdfPagesToImages);
    renderMock.mockResolvedValue([
      { page: 1, dataUrl: "data:image/png;base64,one" },
      { page: 2, dataUrl: "data:image/png;base64,two" },
      { page: 3, dataUrl: "data:image/png;base64,three" },
      { page: 4, dataUrl: "data:image/png;base64,four" },
      { page: 5, dataUrl: "data:image/png;base64,five" },
      { page: 6, dataUrl: "data:image/png;base64,six" }
    ]);

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q",
      chipName: "S55643-51Q",
      preparation: createPreparation({
        documentMeta: {
          fileName: "S55643-51Q.pdf",
          pageCount: 26,
          textCoverage: 0,
          extractionMethod: "none"
        },
        pagePackets: [],
        localCandidates: [],
        complexityFlags: {
          twoColumn: false,
          tableHeavy: false,
          imageHeavy: false,
          watermarkHeavy: false,
          crossPageTableLikely: false,
          lowTextReliability: true
        }
      }),
      identity: {
        canonicalPartNumber: "S55643-51Q",
        manufacturer: "Smarter Micro",
        deviceClass: "Cellular PAM / PA",
        parameterTemplateId: "cellular-3g4g5g",
        focusChecklist: ["band support", "linear output power", "MIPI control"],
        publicContext: [],
        confidence: 0.9
      },
      parameterTemplate: getParameterTemplate("cellular-3g4g5g"),
      publicContext: []
    });

    expect(renderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: [1, 2, 3, 4, 5, 6]
      })
    );
  });

  test("emits provider observability logs for multimodal stages", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                identity: {
                  sku: "UPF5755",
                  manufacturer: "UPMicro (昂璞微)",
                  type: "WiFi Front End Module (FEM)"
                },
                parameterTemplateId: "wifi"
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });
    const preparation = createPreparation({
      identityCandidates: {
        sku: "UPF5755",
        manufacturer: "UPMicro",
        documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
        aliases: []
      }
    });

    await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation,
      publicContext: []
    });

    const lines = infoSpy.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("provider.stage.started"))).toBe(true);
    expect(lines.some((line) => line.includes("provider.stage.rendered"))).toBe(true);
    expect(lines.some((line) => line.includes("provider.request.started"))).toBe(true);
    expect(lines.some((line) => line.includes("provider.request.completed"))).toBe(true);
    expect(lines.some((line) => line.includes("provider.stage.completed"))).toBe(true);
  });

  test("filters cellular key parameters by rf template registry and moves non-parameter items out of the parameter table", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: "S55643-51Q report",
                deviceIdentity: {
                  canonicalPartNumber: "S55643-51Q",
                  manufacturer: "Smarter Micro",
                  deviceClass: "Cellular PAM / PA",
                  parameterTemplateId: "cellular-3g4g5g",
                  confidence: 0.92
                },
                keyParameters: [
                  {
                    id: "p1",
                    label: "Supported bands",
                    value: "n1/n3/n41",
                    title: "频段支持",
                    body: "支持多个蜂窝频段。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p2",
                    label: "Maximum Linear Output Power",
                    value: "31dBm @ n41",
                    title: "线性输出功率",
                    body: "HPUE 条件下的线性输出。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p3",
                    label: "Thermal Design",
                    value: "HPUE thermal challenge",
                    title: "热设计挑战",
                    body: "高功率模式散热风险。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p4",
                    label: "Interface Compatibility",
                    value: "MIPI 2.1",
                    title: "接口兼容风险",
                    body: "与主控兼容性相关风险。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p5",
                    label: "Current values at 31dBm",
                    value: "TBD",
                    title: "待确认电流",
                    body: "具体电流值待确认。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p6",
                    label: "Port Mapping",
                    value: "14 TX ports",
                    title: "端口映射",
                    body: "需要结合滤波器做 RF routing 规划。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p7",
                    label: "APT Power",
                    value: "DC-DC response",
                    title: "APT 电源",
                    body: "属于供电策略与瞬态响应风险。",
                    sourceType: "review",
                    citations: []
                  },
                  {
                    id: "p8",
                    label: "Document Status",
                    value: "Preliminary",
                    title: "文档状态",
                    body: "预发布规格存在变更风险。",
                    sourceType: "review",
                    citations: []
                  }
                ],
                designFocus: [],
                risks: [],
                openQuestions: [],
                publicNotes: [],
                citations: [],
                sections: [
                  {
                    id: "key_parameters",
                    title: "关键参数",
                    body: "参数摘要",
                    sourceType: "review",
                    citations: []
                  }
                ],
                claims: []
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q",
      chipName: "S55643-51Q",
      preparation: createPreparation({
        documentMeta: {
          fileName: "S55643-51Q.pdf",
          pageCount: 26,
          textCoverage: 0,
          extractionMethod: "none"
        },
        pagePackets: [],
        localCandidates: [],
        complexityFlags: {
          twoColumn: false,
          tableHeavy: false,
          imageHeavy: false,
          watermarkHeavy: false,
          crossPageTableLikely: false,
          lowTextReliability: true
        }
      }),
      identity: {
        canonicalPartNumber: "S55643-51Q",
        manufacturer: "Smarter Micro",
        deviceClass: "Cellular PAM / PA",
        parameterTemplateId: "cellular-3g4g5g",
        focusChecklist: ["band support", "linear output power", "MIPI control"],
        publicContext: [],
        confidence: 0.9
      },
      parameterTemplate: getParameterTemplate("cellular-3g4g5g"),
      publicContext: []
    });

    expect(report.keyParameters.map((item) => item.label)).toEqual([
      "Supported bands",
      "Maximum Linear Output Power"
    ]);
    expect(report.designFocus.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Port Mapping", "APT Power"])
    );
    expect(report.risks.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Thermal Design", "Interface Compatibility", "Document Status"])
    );
    expect(report.openQuestions.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Current values at 31dBm"])
    );
  });

  test("normalizes serial flash template ids from flash-like identity payloads", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                canonicalPartNumber: "GD25Q128E",
                manufacturer: "GigaDevice",
                deviceClass: "Serial NOR Flash",
                parameterTemplateId: "serial-flash",
                focusChecklist: ["memory density", "quad spi", "erase architecture"],
                confidence: 0.93
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const identity = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "GD25Q128E.pdf",
      taskName: "GD25Q128E 初步分析",
      chipName: "GD25Q128E",
      preparation: createPreparation({
        documentMeta: {
          fileName: "GD25Q128E.pdf",
          pageCount: 64,
          textCoverage: 58,
          extractionMethod: "none"
        },
        identityCandidates: {
          sku: "GD25Q128E",
          manufacturer: "GigaDevice",
          documentTitle: "Dual and Quad Serial Flash",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(identity.parameterTemplateId).toBe("serial-flash");
    expect(identity.deviceClass).toBe("Serial NOR Flash");
  });

  test("normalizes rf fem family template ids into wifi", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                canonicalPartNumber: "UPF5755",
                manufacturer: "UPMicro",
                deviceClass: "Wi-Fi Front End Module (FEM)",
                parameterTemplateId: "rf-fem-5ghz",
                confidence: 0.91
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const identity = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "UPF5755.pdf",
      taskName: "UPF5755 初步分析",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5GHz Wi-Fi FEM",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(identity.parameterTemplateId).toBe("wifi");
  });

  test("keeps 5ghz 802.11ax wifi fem identities on wifi even when model emits cellular template id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                canonicalPartNumber: "UPF5755",
                manufacturer: "UPMicro",
                deviceClass: "5GHz Wi-Fi 6 Front-End Module (FEM)",
                parameterTemplateId: "cellular-3g4g5g",
                focusChecklist: ["HE160", "VHT80", "truth table"],
                confidence: 0.92
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const identity = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "UPF5755.pdf",
      taskName: "UPF5755 Wi-Fi 6 回归",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5.15 to 5.85GHz 802.11ax WiFi 6 Front End Module HE160 VHT80",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(identity.parameterTemplateId).toBe("wifi");
    expect(identity.deviceClass).toContain("Wi-Fi 6");
  });

  test("normalizes nr multiband power amplifier modules into cellular template instead of power", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                canonicalPartNumber: "S55643-51Q",
                manufacturer: "SmarterMicro",
                deviceClass: "NR MMMB Power Amplifier Module",
                confidence: 0.93
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const identity = await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "S55643-51Q.pdf",
      taskName: "S55643-51Q 初步分析",
      chipName: "S55643-51Q",
      preparation: createPreparation({
        identityCandidates: {
          sku: "S55643-51Q",
          manufacturer: "SmarterMicro",
          documentTitle: "AgiPAM NR MMMB PAM for NR/LTE/3G",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(identity.parameterTemplateId).toBe("cellular-3g4g5g");
  });

  test("normalizes standard report payloads even when relay omits optional arrays", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                executiveSummary: "UPF5755 relay payload",
                deviceIdentity: {
                  canonicalPartNumber: "UPF5755",
                  manufacturer: "UPMicro",
                  deviceClass: "WiFi Front End Module",
                  parameterTemplateId: "wifi",
                  confidence: 0.91
                },
                keyParameters: [
                  {
                    id: "power-1",
                    label: "TX Linear Output Power",
                    value: "17 dBm @ HE160 MCS11",
                    sourceType: "datasheet",
                    citations: [
                      {
                        id: "cite-1",
                        sourceType: "datasheet",
                        page: 4,
                        quote: "17.0 dBm"
                      }
                    ]
                  },
                  {
                    id: "nf-1",
                    label: "RX Gain / Noise Figure / Bypass Loss",
                    value: "NF 2.5 dB",
                    sourceType: "datasheet"
                  }
                ]
              })
            }
          }
        ]
      })
    });

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview",
      baseUrl: "https://example.com"
    });

    const report = await provider.synthesizeReport({
      pdfBuffer: new Uint8Array([1, 2, 3]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
          aliases: []
        }
      }),
      identity: {
        canonicalPartNumber: "UPF5755",
        manufacturer: "UPMicro",
        deviceClass: "WiFi Front End Module",
        parameterTemplateId: "wifi",
        focusChecklist: ["output power", "noise figure", "truth table"],
        publicContext: [],
        confidence: 0.91
      },
      parameterTemplate: getParameterTemplate("wifi"),
      publicContext: []
    });

    expect(report.executiveSummary).toBe("UPF5755 relay payload");
    expect(report.keyParameters.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "RX Gain / Noise Figure / Bypass Loss"
      ])
    );
    expect(
      [...report.keyParameters, ...report.risks, ...report.openQuestions, ...report.designFocus].some(
        (item) => item.label === "TX Linear Output Power"
      )
    ).toBe(true);
    const noiseFigureClaim = report.keyParameters.find((item) => item.label === "RX Gain / Noise Figure / Bypass Loss");
    expect(noiseFigureClaim?.citations ?? []).toEqual([]);
    expect(report.sections).toEqual([]);
    expect(report.claims).toEqual([]);
    expect(report.designFocus).toEqual([]);
    expect(Array.isArray(report.risks)).toBe(true);
    expect(Array.isArray(report.openQuestions)).toBe(true);
    expect(report.publicNotes).toEqual([]);
    expect(report.citations).toEqual([]);
  });
});

describe("GeminiLlmProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  test("sends the PDF as inline application/pdf content instead of image_url parts", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    identity: {
                      sku: "UPF5755",
                      manufacturer: "UPMicro (昂璞微)",
                      type: "WiFi Front End Module (FEM)"
                    },
                    parameterTemplateId: "wifi"
                  })
                }
              ]
            }
          }
        ]
      })
    });

    const provider = new GeminiLlmProvider({
      apiKey: "test-key",
      model: "gemini-3-flash-preview"
    });

    await provider.classifyIdentity({
      pdfBuffer: new Uint8Array([1, 2, 3, 4]),
      fileName: "202307UPF5755 datasheet V1.2.pdf",
      taskName: "UPF5755",
      chipName: "UPF5755",
      preparation: createPreparation({
        identityCandidates: {
          sku: "UPF5755",
          manufacturer: "UPMicro",
          documentTitle: "5.15 to 5.85GHz 802.11ax WiFi Front End Module",
          aliases: []
        }
      }),
      publicContext: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v1beta/models/gemini-3-flash-preview:generateContent");
    const body = JSON.parse(String(init?.body ?? "{}"));
    const parts = body.contents?.[0]?.parts ?? [];
    expect(parts.some((part: { inline_data?: { mime_type?: string } }) => part.inline_data?.mime_type === "application/pdf")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("image_url");
  });

});
