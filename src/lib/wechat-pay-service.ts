/**
 * 兼容垫片（Microkernel 2.0 战役 5）：旧路径 @/lib/wechat-pay-service 已迁移至
 * @/adapters/payment/wechat-pay-service。保留本文件以兼容存量测试/外部引用。
 * @deprecated 直接改用 "@/adapters/payment/wechat-pay-service"
 */
export * from "@/adapters/payment/wechat-pay-service";
export { WeChatPayService, wechatPayService } from "@/adapters/payment/wechat-pay-service";
