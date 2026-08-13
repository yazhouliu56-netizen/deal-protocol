# ADR-0015: 动态表单引擎 + base/geo RN 适配（N2 + N16）

日期：2026-08-13
状态：Accepted（缺口 N2 + N16 落地；功能层迭代第六批）

## 六圈定位声明
- 所属圈：第一圈 · 通用层
- 所属模块：动态表单渲染引擎通用化、base/geo RN 适配层接口
- 复用底座：`base/geo/geo.ts`（geocode 复用 geoFromName）、`base/ammo`（业务表单字段走弹药声明）
- 弹药表：对应业务字段仍走 ammo 声明——本引擎是渲染通用层，业务 Schema 填表即出新表单

## 宪法条文对照
- 命中条文：**#1 底座弹药解耦**（动态表单引擎不感知具体业务字段，业务方填 `FormField[]` 即出表单）、**#6 信任数据是瞄准镜**（RN 经纬度接入让地理数据成为撮合依据）、**#10 降级设计**（RN 地理位置不可得时 `setGeoSrc` 回落到 mock/geoFromName）
- 偏离条文：无

## Context

- N2：mobile DynamicForm 已私有实现，web 无通用表单渲染引擎，「同一份 Schema 双端渲染」缺通用化。
- N16：`base/geo` 是 web P2P 地图的坐标工具，mobile 的 location.ts 无法直接复用——缺 RN 适配接口。

## Decision

### 一、动态表单引擎（`src/base/form/dynamicForm.ts` 纯函数）
- `FormField`（text/number/select/multiselect/boolean/textarea，含 required/min/max/pattern/options）。
- `validateField`/`validateForm`（必填/数字范围/select 有效性/multiselect 至少一项）。
- `toRenderNodes`（schema → 中性渲染描述器：input/textarea/picker/group/checkbox，任意端可渲染）。
- `isSubmittable`（可提交判定）。

### 二、base/geo RN 适配（`src/base/geo/geoAdapter.ts`）
- `GeoSrc` 接口（platform/current/permission/geocode）+ `MockGeoSrc`（web 演示）。
- `setGeoSrc`/`getGeoSrc`（注入点）/`isRn`。mobile location.ts 消费 `GeoSrc` 即可共享 base/geo。

## Consequences
- 新增 `base/form/dynamicForm.ts`、`base/geo/geoAdapter.ts`、`form.test.ts`（+3 单测）；
- 缺口 N2/N16 关闭；单测 365 全绿。
- 后续（单独 ADR）：mobile location.ts 实现 GeoSrc、payload 校验 Schema 接入引擎、web PublishSheet 迁移到引擎渲染。