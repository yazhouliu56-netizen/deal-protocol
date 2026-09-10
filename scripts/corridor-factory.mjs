import { getE2eBaseUrl } from "./lib/e2e-channel.mjs";
import assert from "node:assert/strict";

const BASE = getE2eBaseUrl();
let failures = 0;
try {
  const res = await fetch(BASE + "/admin/factory", { redirect: "manual" });
  assert.equal(res.status, 307, "unauthenticated admin must redirect");
  const loc = res.headers.get("location") ?? "";
  assert.ok(loc.includes("/login"), "redirect target must be /login, got " + loc);
  console.log("corridor-factory: auth gate PASS (307 -> /login)");
} catch (e) {
  console.error("corridor-factory FAILED:", e.message ?? e);
  failures += 1;
}
process.exit(failures === 0 ? 0 : 1);
