import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getGeoSrc,
  setGeoSrc,
} from "@/adapters/geo/geoAdapter";
import { distanceKm } from "@/base/geo/geo";
import {
  isSubmittable,
  toRenderNodes,
  validateForm,
  type FormField,
} from "@/base/form/dynamicForm";

test("RN 适配：web 默认 mock 可注入替换，geo 计算共享", () => {
  assert.equal(getGeoSrc().platform, "web");
  const rn = setGeoSrc({ platform: "rn", current: async () => ({ lat: 1, lng: 2 }), permission: async () => "granted", geocode: async () => null });
  assert.equal(isRn(), true);
  assert.equal(getGeoSrc(), rn);
  assert.ok(distanceKm({ lat: 30, lng: 104 }, { lat: 30.1, lng: 104 }) > 10);
});

function isRn(): boolean {
  return getGeoSrc().platform === "rn";
}

const FIELDS: FormField[] = [
  { key: "name", label: "联系人", type: "text", required: true },
  { key: "budget", label: "预算", type: "number", required: true, min: 10 },
  { key: "level", label: "水平", type: "select", options: [{ label: "新手", value: "newbie" }], required: true },
  { key: "tags", label: "标签", type: "multiselect", required: true },
];

test("动态表单：必填/数字范围/select 校验", () => {
  const errs1 = validateForm(FIELDS, {});
  assert.equal(errs1.length, 4);
  const errs2 = validateForm(FIELDS, { name: "张", budget: 5, level: "newbie", tags: ["a"] });
  assert.equal(errs2.length, 1);
  assert.equal(errs2[0].key, "budget");
});

test("动态表单：submittable 判断", () => {
  assert.equal(isSubmittable(FIELDS, { name: "x", budget: 100, level: "newbie", tags: ["a"] }), true);
  assert.equal(isSubmittable(FIELDS, { name: "x", budget: 100, level: "newbie" }), false);
});

test("动态表单：渲染描述器映射", () => {
  const nodes = toRenderNodes(FIELDS, { name: "张" });
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));
  assert.equal(byKey.name.type, "input");
  assert.equal(byKey.tags.type, "group");
  assert.equal(byKey.level.options?.[0].label, "新手");
});