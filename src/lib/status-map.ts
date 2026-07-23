export type { DemandStatus } from "./demand/state"

export type DemandFulfillmentStatus = 'ASSIGNED' | 'DEPARTED' | 'ARRIVED' | 'STARTED' | 'COMPLETED';

export const STATUS_MAP: Record<DemandFulfillmentStatus, { title: string; desc: string }> = {
  ASSIGNED: { title: "已接单", desc: "师傅正在准备出发" },
  DEPARTED: { title: "已出发", desc: "师傅正在赶往您的路上" },
  ARRIVED: { title: "已到达", desc: "师傅已到达现场，准备开工" },
  STARTED: { title: "施工中", desc: "师傅正在为您服务中" },
  COMPLETED: { title: "已完工", desc: "服务已结束，感谢使用" },
};

export type DemandFinancialStatus = 'pending_payment' | 'paid_escrow' | 'settled';

export const FINANCIAL_STATUS_MAP: Record<DemandFinancialStatus, { title: string; desc: string }> = {
  pending_payment: { title: "待付款", desc: "订单已创建，请完成支付以托管资金" },
  paid_escrow: { title: "资金已托管", desc: "您的资金已安全托管至平台，服务进行中" },
  settled: { title: "已结算", desc: "资金已释放至服务商钱包，订单圆满结束" },
};
