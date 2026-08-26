/**
 * 兼容垫片（Microkernel 2.0 战役 5）：旧路径 @/lib/alipay-service 已迁移至
 * @/adapters/payment/alipay-sandbox-channel。保留本文件以兼容存量测试/外部引用。
 * @deprecated 直接改用 "@/adapters/payment/alipay-sandbox-channel"
 */
export * from "@/adapters/payment/alipay-sandbox-channel";
export { AlipayService, alipayService } from "@/adapters/payment/alipay-sandbox-channel";
