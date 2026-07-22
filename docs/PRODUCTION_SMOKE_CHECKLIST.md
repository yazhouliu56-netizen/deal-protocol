# Production Smoke Test Checklist

> 上线前逐项验证，确保核心链路在生产环境正常运行。

## How to Run

```bash
# 默认目标 https://deal-protocol.vercel.app
npx playwright test e2e/production-smoke.spec.ts

# 指定自定义域名
BASE_URL=https://your-custom-domain.com npx playwright test e2e/production-smoke.spec.ts
```

---

## Checklist

| # | Category | Check Item | Expected | Auto | Manual |
|---|----------|------------|----------|------|--------|
| 1 | **Network** | HTTPS 强制跳转 | HTTP → 301 → HTTPS | ✓ | |
| 2 | **Network** | `X-Content-Type-Options` 响应头 | `nosniff` | ✓ | |
| 3 | **Network** | `X-Frame-Options` 响应头 | `DENY` | ✓ | |
| 4 | **Network** | `Referrer-Policy` 响应头 | `strict-origin-when-cross-origin` | ✓ | |
| 5 | **Network** | 首页 HTTP 200 | 状态码 200 | ✓ | |
| 6 | **Realtime** | Supabase WebSocket (`wss://`) 握手 | 连接建立成功 | ✓ | |
| 7 | **Realtime** | SSE `/api/sse` 端点 | 返回 `text/event-stream` | | ✓ |
| 8 | **Mobile** | Viewport 390×844 无横向溢出 | `scrollWidth ≤ clientWidth` | ✓ | |
| 9 | **Mobile** | Header 导航按钮 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 10 | **Mobile** | 需求卡片交互区域 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 11 | **Mobile** | 订单角色 Tab 按钮 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 12 | **Mobile** | SOS 紧急按钮 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 13 | **Mobile** | 维权链接按钮 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 14 | **Mobile** | 财务提现/刷新按钮 ≥ 44px | `boundingBox` min ≥ 44 | ✓ | |
| 15 | **Auth** | `/login` 页面可访问 | HTTP 200, 无重定向循环 | | ✓ |
| 16 | **Auth** | 登录 → Dashboard 跳转 | URL 含 `/dashboard` | | ✓ |
| 17 | **Core** | 需求广场 `/demands` | HTTP 200, 无 console error | ✓ | |
| 18 | **Core** | 订单中心 `/orders` | HTTP 200, 无 console error | ✓ | |
| 19 | **Core** | 维权仲裁 `/disputes` | HTTP 200, 无 console error | ✓ | |
| 20 | **Core** | 财务仪表盘 `/finance` | HTTP 200, 无 console error | ✓ | |
| 21 | **Core** | 需求发布页 `/demands/new` | HTTP 200 | | ✓ |
| 22 | **Core** | Admin 后台 `/admin` (需权限) | HTTP 200 或 适当 401/403 | | ✓ |
| 23 | **Payment** | 支付页面 `/payment/{id}` | 正常渲染支付方式选择 | | ✓ |
| 24 | **Payment** | Stripe 测试卡支付 | 成功完成支付流程 | | ✓ |
| 25 | **LLM** | AI 分类 `/api/llm-classify` | 返回 200 + 正确分类 | | ✓ |

---

## Monitor After Deploy

- [ ] Vercel Dashboard: Build Log 无 Error
- [ ] Vercel Dashboard: 函数调用无 Timeout (默认 10s, 长任务需调至 30s)
- [ ] Supabase Dashboard: 数据库连接数无异常激增
- [ ] Supabase Dashboard: Realtime 通道连接正常
- [ ] Sentry / Error Tracking: 无新增未处理异常
