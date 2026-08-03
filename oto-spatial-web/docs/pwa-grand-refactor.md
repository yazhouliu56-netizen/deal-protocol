# oto-spatial-web 完整大改方案与执行手册

> 基线：Next.js 16.2.12 + React 19 + TS strict + Tailwind v4 + Three.js 0.185 + 自研 Service Worker
> 目标：对照《PWA 全栈技术图谱》逐项补齐，同时守住"每阶段可构建、可验证、可回滚"底线。

---

## 一、现状盘点（真实代码基线）

| 板块 | 现状 | 差距 |
|---|---|---|
| 框架 | Next.js 16 App Router + Turbopack | 非 Vite（保留，见决策 D1） |
| 状态 | 全部 `useState` 在 `page.tsx`（dock/category/swatch/selected/cart） | 无全局状态层 |
| 3D | `ProceduralSpatialCanvas.tsx`：**原生命令式 three.js**（Sphere/Box/Torus 程序化几何），R3F/drei 已装未用 | 未 R3F 化、无 .glb、无 Environment、无 LOD |
| AR | 伪 AR：指针拖拽 360° 旋转，`4.5 m` 为静态文案 | 无 WebXR Hit Test / 平面识别 |
| 动效 | CSS keyframes（float/aurora/page-enter），framer-motion 已装未用 | 无 JS 动效 |
| 地图 | Trip 页 CSS 伪 3D 网格 + SVG 轨迹 | 无真实地理（Mapbox） |
| 数据 | `mockData.ts` 纯静态 | 无 Supabase/存储 |
| PWA | 手写 `public/sw.js`（network-first + SWR + App Shell）+ manifest + 图标 | 无 3D 模型预缓存、无性能降级 |

---

## 二、目标架构

```
[UI] Next.js 16 + Tailwind v4 + 自建设计系统组件（src/components/ui/*）
    ├── 动效：Framer Motion（页面切换/卡片弹性/3D 滑入）
    ├── 地图：Mapbox GL JS（P3 可选）
    ├── 3D：React Three Fiber 组件树 + drei（Environment / RoundedBox / GLTF+Draco / LOD）
    ├── AR：全息预览为主路径 + @react-three/xr 平面识别为 Android 渐进增强（P1.4 实验）
    └── 状态：Zustand（src/store/*）
[数据] Supabase（oto schema + RLS，在线优先）→ 离线降级内置 mock
[存储] Cloudflare R2（.glb + 图片，P4）
[构建] Next build + 手写 SW（升级：关键模型预缓存 + 低端机降级策略）
```

---

## 三、决策点（先读再执行）

- **D1 保留 Next.js，不迁 Vite**：SSR/静态输出能力 + 已验证的 SW 管道均为正资产；Vite 迁移是负收益。
- **D2 不上 shadcn/ui**：现有毛玻璃/渐变发光设计系统高度定制且已成型，shadcn 侵入大收益低。替代方案：把散落的 `glass-panel` 用法规范化为 `src/components/ui/` 基础组件（Button/Card/Badge/Dock）。
- **D3 WebXR 不是主路径**：iOS Safari 无解（文档已警告）。主路径保持全息预览；`@react-three/xr` 平面识别作为 Android 实验性渐进增强，默认关闭。
- **D4 手写 SW 保留升级，不上 Workbox**：现有策略已实战验证；只补模型预缓存与降级。
- **D5 Mapbox 需 access token**：无 token 则跳过 P3（现有 CSS 地图保留为降级）。

---

## 四、分阶段执行手册

### P0 工程化基础（0.5~1 天，零风险）

**目标**：Zustand 全局状态 + Framer Motion 动效基础。

**1. 安装**
```bash
npm install zustand
# framer-motion 已在依赖中
```

**2. 新建 `src/store/useAppStore.ts`**
```ts
// state: screen(dock), activeCategory, activeSwatch, selectedExperienceId, cart[], wishlist[]
// actions: setScreen, openExperience, toggleCart, setSwatch, setCategory
```
状态迁移来源：`page.tsx` 中 5 个 `useState`。组件通过 store 读写，`ProceduralSpatialCanvas` 的 `modelColor`/`mode` 也改从 store 取（去掉 props 链）。

**3. 页面切换动画（Framer Motion）**
- 删除 `.page-enter` CSS 用法，改 `AnimatePresence mode="wait"` + `motion.div`（fade + y:18 + spring）。
- 卡片 hover 弹性：`whileHover={{ y: -6, scale: 1.02 }}`。

**4. 验证**
```bash
npm run lint && npm run build
```
Playwright：三屏切换动画存在（transitionend/motion class）、分类筛选、swatch 改色仍生效；零控制台错误。

**回滚**：备份 `src/app/page.tsx` 到 `.opencode/backups/p0-<日期>/`。

---

### P1 3D 栈核心升级（2~3 天，最高风险 → 单独交付）

**目标**：R3F 组件化 + drei 质感资产 + 模型加载与 LOD。

**1. 安装**
```bash
npm install @react-three/xr   # 仅 P1.4 实验用
```

**2. R3F 重构 `src/components/3d/`**
```
3d/
├── ProceduralSpatialCanvas.tsx   ← 保留为降级路径（不删除，导出原实现）
├── Stage.tsx                     ← 新：R3F <Canvas> 根（dpr={[1,1.75]}、shadows）
├── FurnitureScene.tsx            ← 沙发/设备场景（AR 模式）
├── StarDust.tsx                  ← 60 粒子点云（ambient + AR 共用）
└── models/
    └── useGlobeModel.ts          ← 全息球（可保留程序化，不强制 .glb）
```
- `Page.tsx` 根据模式挂载 `FurnitureScene` / `StarDust`；拖拽逻辑迁入 R3F（`useFrame` + pointer 事件），沿用惯性阻尼参数。
- 保留原 canvas 作为 `R3F unsupported` 时的降级（P1 验证后决定是否删除）。

**3. drei 质感资产**
- `Environment preset="city"`（或 `files="/hdr/studio.hdr"`）包裹家具场景 → 沙发获得镜面/环境反射（对应文档"图2 高光质感"）。
- 沙发底座/坐垫改用 `RoundedBoxGeometry`（`args={[1.2,0.25,0.8,4,0.08]}`）。
- 粒子保留 `Points`，材质 `sizeAttenuation` + additive。

**4. GLTF + Draco + LOD + 加载进度（对应文档性能警示）**
- 放 1 个测试模型 `public/models/lounge.glb`（Draco 压缩，建议 < 1MB）。
- `useGLTF` + `useDraco`（需安装 `three-stdlib` 内置 draco decoder 或 CDN decoder）。
- `LoadingBar` 组件：`useProgress`（drei）→ 顶部进度条，首帧模型未就绪前显示骨架占位。
- LOD：`<LOD>` 或手动两个面数档位（近 `detail=1`，远 `detail=0`），`useFrame` 按相机距离切换。
- **SW 预缓存**：`public/sw.js` 的 APP_SHELL 数组追加 `/models/lounge.glb`（离线首屏可看核心模型）。

**5. WebXR 实验（默认关闭，D3）**
- `@react-three/xr` 的 `<XR>` + `XRRaycaster` 平面命中：仅当 `navigator.userAgent` 命中 Android Chrome 且用户点"进入 AR"按钮时启用。
- iOS/桌面一律回退全息预览。此功能不阻塞主线验收。

**6. 验证**
- `npm run lint && npm run build`；生产启动。
- Playwright：AR 页 3D 拖拽命中、swatch 改色、加载进度条出现与消失、离线 reload 后模型仍渲染（canvas 像素非空）。
- 性能：`deviceMemory >= 8` 机器上 DPR 1.75 流畅；`< 4` 降级 DPR 1。

**回滚**：整目录备份 `src/components/3d/`。

---

### P2 UI 设计系统与动效（1~2 天）

**目标**：组件规范化 + 动效全覆盖 + 加载占位。

**1. 新建组件原语**（从 page.tsx 抽取，样式沿用现有 CSS 类）
```
src/components/ui/
├── GlassCard.tsx        (glass-panel / -interactive / -active 三态)
├── GlassButton.tsx      (btn-primary / 描边两态)
├── Badge.tsx            (AR 胶囊 / rating 胶囊)
├── SearchBar.tsx
└── FloatingDock.tsx     (重构为读 store，去掉 props)
```

**2. 动效覆盖**
- `AnimatePresence`：购物车/收藏飞入动画；Info 面板展开。
- 卡片列表进入：`motion.article` stagger 交错。
- 3D 模型屏幕外滑入：AR 页挂载时 `useSpring` 驱动 sofa 初始位移动画。

**3. 图片加载占位**
- 目的地卡片图：`next/image` 或占位 div + `onLoad` 淡入；Unsplash 慢速时显示 shimmer 骨架。
- 滚动懒加载：`IntersectionObserver`（自定义 hook `useInView`）。

**4. 验证**：build + 桌面/移动视口截图对比无回归；网络节流 3G 下卡片先骨架后图片。

---

### P3 真实地图（可选，1 天，依赖 token，D5）

**目标**：Trip 页接入 Mapbox GL JS 3D 地图。

1. `npm install mapbox-gl` + `NEXT_PUBLIC_MAPBOX_TOKEN`（.env.local）。
2. `TripPage` 地图卡替换为 `<MapboxMap>` 组件：3D 地形（`terrain` + `sky`）+ 两个 `Marker`（马尔代夫/巴厘岛）+ 路线 `GeoJSON line`（紫→青渐变，数据用 `coordinates` 字段）。
3. 无 token 或离线时：fallback 到现有 CSS 3D 网格地图（组件内自动切换）。
4. **验证**：有 token 时地图渲染 + 标记可见；无 token 时 fallback 正常，无报错。

---

### P4 数据层 Supabase 化（1~2 天）

**目标**：在线真实数据 + 离线降级，接口形态不变。

**1. 安装与客户端**
```bash
npm install @supabase/supabase-js
```
新建 `src/lib/supabase.ts`（`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` 环境变量，无则跳过在线层）。

**2. 数据库（仓库根已有 supabase 基建）**
```
supabase/migrations/<ts>_oto_catalog.sql
  oto_experiences(id, title, subtitle, category, price, rating, location, has_ar, image_url, description, coordinates jsonb)
  oto_activities(id, type, title, subtitle, time, location, image_url)
RLS：anon 只读 SELECT；写入仅认证用户（购物车/行程留待下期）
```

**3. 数据访问层 `src/lib/api.ts`**
- `getExperiences()` / `getActivities()`：Supabase 在线查询；失败/离线 → 返回内置 `mockData`（与 SW 离线壳配套）。
- 保留 `mockData.ts` 作为 fallback 源（不删除）。

**4. 验证**：无环境变量时全流程仍走 mock（CI/本地零配置可跑）；有环境变量时数据来自表。

---

### P5 PWA 深化与性能降级（1 天）

**目标**：低端机流畅 + 离线体验完整。

**1. SW 升级（`public/sw.js`）**
- APP_SHELL 预缓存追加：`/models/lounge.glb`、关键 HDR（若本地化）。
- 运行时缓存：`/models/*`、`*.glb`、`*.hdr` 走 SWR（已有通道，加白名单）。
- `CACHE_VERSION` 升级触发旧缓存清理（已有逻辑，验证）。

**2. 性能降级策略（`globals.css` + `useAppStore`）**
- `deviceMemory < 4` 或 `prefers-reduced-motion`：`document.documentElement.dataset.lowPower = "1"` → CSS 关闭 aurora 动画/starfield 闪烁、DPR 锁 1、粒子减半。
- WebGL 上下文失败：`isWebGL2Available` 检查 → 显示纯 CSS 背景降级壳。

**3. Manifest 精调**：确认 `theme_color` 深紫（#7B61FF 系）与 `background_color` 匹配 `#0d0f1d`（防白屏），`display: standalone`。

**4. 验证**：模拟 `deviceMemory=2` 时低功耗类生效（computed 检查）；离线全流程（Home/AR/Trip + 模型）可浏览。

---

## 五、执行顺序与依赖图

```
P0（无依赖）→ P1（依赖 P0 store）→ P2（可并行 P1 后半）
→ P3（可选，独立）→ P4（独立，可并行 P2/P3）→ P5（依赖 P1 模型产物）
```
建议每次会话只推进 1 个阶段，完成后跑：
```bash
npm run lint && npm run build
# 生产验证（沿用现有 cmd.exe wrapper + Playwright 检查点）
```

## 六、风险清单

| 风险 | 等级 | 对策 |
|---|---|---|
| R3F 重构回归拖拽/改色 | 高 | P1 单独交付 + 旧 canvas 保留降级 + 全量 Playwright 回归 |
| .glb 离线体积 | 中 | Draco 压缩 + SW 预缓存 + LOD |
| iOS 无 WebXR | 中 | D3：全息预览主路径，XR 默认关 |
| Mapbox token 缺失 | 低 | P3 fallback 已设计 |
| Supabase 环境缺失 | 低 | api.ts 自动降级 mock |
| 低端机毛玻璃卡顿 | 中 | P5 降级策略 |
