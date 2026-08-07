import { test } from "node:test";
import assert from "node:assert/strict";
import { templateForCategory } from "./sceneTemplate.ts";

test("Beach/Mountains -> view, Adventure -> court, City/Historical -> interior", () => {
  assert.equal(templateForCategory("Beach"), "view");
  assert.equal(templateForCategory("Mountains"), "view");
  assert.equal(templateForCategory("Adventure"), "court");
  assert.equal(templateForCategory("City"), "interior");
  assert.equal(templateForCategory("Historical"), "interior");
});

test("unknown category falls back to lounge (furniture model)", () => {
  assert.equal(templateForCategory("Sport"), "lounge");
  assert.equal(templateForCategory(""), "lounge");
});