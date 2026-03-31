const parameterLabelMap: Record<string, string> = {
  "Document pages": "文档页数",
  "Chip name": "芯片名称",
  Task: "任务",
  "Source file": "源文件",
  "Input voltage": "输入电压",
  "Output current": "输出电流",
  "Switching frequency": "开关频率",
  Category: "器件类别",
  "Transmit gain": "发射增益",
  "Receive gain": "接收增益",
  Package: "封装",
  "RFFE bus": "RFFE 总线",
  "Maximum Linear Output Power": "最大线性输出功率",
  "Supported bands": "支持频段"
};

export function displayParameterName(name: string) {
  return parameterLabelMap[name] ?? name;
}
