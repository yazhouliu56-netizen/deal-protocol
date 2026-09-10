import fs from "node:fs";
const L = fs.readFileSync("scripts/e2e-wave.mjs", "utf8").split("\n");
const head = L.slice(0, 230).join("\n");
const tail = L.slice(321, 329).join("\n");
const clickTrip = L[153];
const shots = [
  "  await pageA.reload({ waitUntil: 'domcontentloaded' });",
  "  " + clickTrip.trim(),
  "  await pageA.waitForTimeout(500);",
  "  await waitUntil(pageA, () => !!document.querySelector('[data-testid=\"fulfillment-center\"]'), 15000, 'A sees Panel');",
  "  assert.equal(await pageA.getByTestId('intervene-bar').count(), 1, 'intervene bar renders');",
  "  assert.equal(await pageA.getByTestId('money-strip').count(), 1, 'money strip renders');",
  "  await pageA.getByTestId('fulfillment-center').screenshot({ path: 'docs/shot/p2-panel-live.png' });",
  "  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-strip.png' });",
  "  console.log('corridor-panel: 2 shots PASS');",
].join("\n");
fs.writeFileSync(
  "scripts/corridor-panel.mjs",
  head + "\n" + shots + "\n" + tail + "\n",
);
console.log("written ok");
