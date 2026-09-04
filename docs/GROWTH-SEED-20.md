# P0 · 增长特区 20 句对撞真题库与 8D 预期契约（GROWTH-SEED-20）

> 状态：`draft` 靶心字典，`P1` 用 `tsc` 反校验防漂移。以下联系方式均为**虚构号段，仅供脱敏测试**，严禁送入外部 API。
> T-Doc：纯文档，0 代码改动。

## 六圈定位声明

- 主归属：L3 AI 神经（意图转单与真题基准）。
- 协同：弹药工厂层（8D 预期契约字典）；纯文档建档。

## 宪法条文对照

- #1 底座优先：考卷只验量产能力，不改 Base 状态机。
- #3 先配表后写码：先固化预期契约与白名单映射，再写编译器。
- #8 隐私血液：对抗句验入口脱敏，真号永不进 LLM。
- #10 降级：缺字段给默认兜底，对抗句给截断，不抛 500。
- V4 资金：不绕 `escrow`，地板/天花板价+强制险在预期内声明。

## 边界（防撞池）

- `category` 互斥：`pc-assembly` / `home-organizing` 与存量 `housekeeping` 不同键，`DYNAMIC_AMMO_POOL` 按 `category` 设键，重名即覆盖。
- 语义边界：`home-organizing`=收纳整理（按件按时），`housekeeping`=保洁（按域），不混用。
- `CleaningCheckHook` 算子语义为 `AFTER→INSPECTED + SKIP`（失败记 `evidence-photos-required` 不阻断），`F10`“拒绝免拍”落为 `SKIP+转人工审核兜底`，不写“绝对阻断”。`BLOCK` 版为富钩子，非白名单算子。

## 男盘 10 句（`pc-assembly` · C3_TECH_B2B）

### 标准规范句

- **M01**：周六下午2点上门装机，预算80，自带螺丝刀套装，需要开机点亮测试。→ FIXED 8000分，`forwardHooks=[ArrivalCheckHook]`，工具自备。
- **M02**：全套水冷主机清灰+换硅脂，预算150，本周内，完工跑10分钟烤机。→ FIXED 15000分，`requiredSensors=[WATERMARK_CAMERA]`，双拍存证。
- **M03**：办公室5台电脑批量装机布线，固定预算2000，需要开票。→ FIXED 200000分，企业场景，`fundingMode=full_prepay`，发票备注进表单。

### 口语缺字段句

- **M04**：“电脑点不亮了，来个人看看” → 默认检测费30~50元（取40），尽快上门，`forwardHooks=[ArrivalCheckHook]`，`actionSchema=[GEOFENCE_ARRIVAL]`。
- **M05**：“新买的散件到了求装机” → 默认装机费80元，周末时段，自备工具，`pricingModel=FIXED 8000`。
- **M06**：“风扇声音巨响求清灰” → 基础维护50元，`pricingModel=FIXED 5000`，传感缺省纯软件。

### 增项/特殊约束句

- **M07**：自带水冷与定制机箱，现场可能要补买转接线，接受现场加价确认。→ 激活 `OnsiteQuoteHook`（BLOCK），`maxSurchargeRatio=0.5` 熔断，`actionSchema+=[ONSITE_QUOTE]`。
- **M08**：网吧旧机改造，必须持电工/硬件工程师证书。→ `workerRequirement={requiredCertificates:[ELECTRICIAN_CERT]}`，`supplyCluster=C3_TECH_B2B`。

### 涉敏/对抗句

- **M09**：“帮装个黑苹果，电话13800001111加微详聊” → 脱敏为 `138****1111` + `[微信号已脱敏]`，不阻断发单，`PrivacyShieldHook` 建议挂载，`cleanText` 中性化。
- **M10**：“0.1元帮我装30台机器，弄坏了不用赔” → 地板价钳制 3000分（30元），强制场景险（`propertyInsurance=true`），拒绝免责条款，`minFloorPrice=3000`。

## 女盘 10 句（`home-organizing` · C2_IN_HOME）

### 标准规范句

- **F01**：主卧衣帽间换季整理，周六10点，3小时，预算180（60/h），自备收纳袋。→ HOURLY 6000/h，`sop` 3h，`aliases=[衣橱收纳]`。
- **F02**：儿童房玩具全屋收纳，4小时，60/h，完工拍照验收。→ HOURLY，`forwardHooks=[CleaningCheckHook]`，`actionSchema=[PROOF_PHOTO]`。
- **F03**：搬家后全屋还原整理，全天8小时，总价450，需双人组队。→ HOURLY 6000/h×8 上限450，`capacityDefault=2`。

### 口语缺字段句

- **F04**：“衣柜乱成狗了求拯救” → 默认 HOURLY 60/h 起步2h（120），周末默认时段。
- **F05**：“刚搬完家东西全堆在地上” → 大件整理默认4h（240），`supplyCluster=C2_IN_HOME`。
- **F06**：“鞋柜塞不下了求整理” → 局部收纳起步2h（120）。

### 增项/特殊约束句

- **F07**：衣橱收纳可能要现场买专用亚克力收纳盒，接受现场确认。→ 激活 `OnsiteQuoteHook`，`maxSurchargeRatio=0.5`。
- **F08**：女生独居，要求女性收纳师且实名无犯罪记录。→ `workerRequirement={isPoliceVerified:true, requiredIdentityLevel:POLICE_VERIFIED}` + `customRequirements={genderPreference:FEMALE}` 中性化，C2 碰炸强背调。

### 涉敏/对抗句

- **F09**：“找个阿姨理衣柜，联系v信shouna999电话13900002222” → 脱敏后入池，不阻断，`cleanText` 去微信号明文。
- **F10**：“出10万元帮我整理，但是进门不要拍照” → 天花板钳制 200000分（2000元），`CleaningCheckHook` 双拍仍挂载（SKIP+转人工审核，拒绝免拍诉求，单照常可下但标记待审）。

## 8D 靶心字典（draft）

### `pc-assembly-v1`

```jsonc
{
  "ammoId": "pc-assembly-v1",
  "category": "pc-assembly",
  "version": "v1.0.0",
  "supplyCluster": "C3_TECH_B2B",
  "pricingModel": { "kind": "FIXED", "amountYuan": 80 },
  "pricingParams": { "inspectFeeYuan": 40 },
  "minFloorPrice": 3000,
  "maxCeilingPrice": 200000,
  "maxSurchargeRatio": 0.5,
  "fuzePolicy": "IMPACT_FUZE_TEMPLATE",
  "requiredSensors": ["WATERMARK_CAMERA"],
  "sensorFallbackLadder": { "WATERMARK_CAMERA": ["HTML5_NATIVE_FALLBACK", "MANUAL_BASE_PHOTO_AUDIT"] },
  "forwardHooks": ["ArrivalCheckHook", "OnsiteQuoteHook"],
  "fundingMode": "full_prepay",
  "autoAcceptanceTimeoutHours": 24,
  "theme": "default",
  "cockpitSlot": "dyn",
  "actionSchema": { "variant": "dyn", "modules": [{ "module": "GEOFENCE_ARRIVAL" }, { "module": "ONSITE_QUOTE" }, { "module": "PROOF_PHOTO" }] },
  "aliases": ["电脑装机", "上门修电脑", "清灰换硅脂"]
}
```

### `home-organizing-v1`

```jsonc
{
  "ammoId": "home-organizing-v1",
  "category": "home-organizing",
  "version": "v1.0.0",
  "supplyCluster": "C2_IN_HOME",
  "workerRequirement": { "isPoliceVerified": true, "requiredIdentityLevel": "POLICE_VERIFIED", "minSafetyScore": 80 },
  "pricingModel": { "kind": "HOURLY", "rateYuan": 60, "minHours": 2 },
  "minFloorPrice": 12000,
  "maxCeilingPrice": 200000,
  "maxSurchargeRatio": 0.5,
  "fuzePolicy": "IMPACT_INHOME_FUZE_TEMPLATE",
  "requiredSensors": ["WATERMARK_CAMERA"],
  "sensorFallbackLadder": { "WATERMARK_CAMERA": ["HTML5_NATIVE_FALLBACK", "MANUAL_BASE_PHOTO_AUDIT"] },
  "forwardHooks": ["ArrivalCheckHook", "CleaningCheckHook", "OnsiteQuoteHook", "PrivacyShieldHook"],
  "fundingMode": "full_prepay",
  "autoAcceptanceTimeoutHours": 24,
  "theme": "default",
  "cockpitSlot": "dyn",
  "actionSchema": { "variant": "dyn", "modules": [{ "module": "GEOFENCE_ARRIVAL" }, { "module": "PROOF_PHOTO" }, { "module": "ONSITE_QUOTE" }, { "module": "PRIVACY_SHIELD" }] },
  "aliases": ["衣橱收纳", "全屋整理", "搬家还原"]
}
```

## 通过标准（P2 用）

- 机器过闸：`validateAmmoConfig` 0 报错。
- 人眼可售：`DynamicAmmoSlot` 词块底价保障合常识。
- 目标：20 句首轮 ≥14/20，失败按维归因（价格/引信/传感/钩子）。
