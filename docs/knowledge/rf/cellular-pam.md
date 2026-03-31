# Cellular PAM

## 系统角色
Cellular PAM / PA 的核心不是单个 dBm，而是“在指定 band、mode、bandwidth 和线性指标下能输出多少功率”。
必须确认它与主控/收发器的控制接口、供电方式和热代价是否匹配。

## 必看参数
- supported bands
- mode coverage
- bandwidth capability
- maximum linear output power
- ACLR / EVM condition
- RFFE / MIPI control
- current consumption
- VCC / supply
- package
- HPUE support（如适用）

## 常见误读
- 只看最大功率，不看 ACLR/EVM 条件
- 忽略高带宽、HPUE、特定 band 下的电流和热代价
- 忽略 RFFE 版本与寄存器控制兼容性
- 把 layout/thermal 建议误记成参数真值
