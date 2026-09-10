import fs from "node:fs";
const raw = fs.readFileSync("scripts/e2e-acceptance.mjs", "utf8");
const L = raw.split("\n");
const head = L.slice(0, 71).join("\n");
const scenario = L.slice(269, 333).join("\n");
const tail = L.slice(369, 377).join("\n");
const clickTrip = L[310];
const scenario2 = L.slice(341, 366).join("\n");
const shots = [
  "  await pageA.reload({ waitUntil: 'domcontentloaded' });",
  "  " + clickTrip.trim(),
  "  await pageA.waitForTimeout(500);",
  "  await waitUntil(pageA, () => { const el = document.querySelector('[data-testid=\"money-strip\"]'); return el && el.getAttribute('data-phase') === 'disputed'; }, 15000, 'strip disputed');",
  "  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-disputed.png' });",
  "  console.log('corridor-dispute: 1 shot PASS');",
].join("\n");
const shots2 = [
  "  await pageA.reload({ waitUntil: 'domcontentloaded' });",
  "  " + clickTrip.trim(),
  "  await pageA.waitForTimeout(500);",
  "  await waitUntil(pageA, () => !!document.querySelector('[data-testid=\"money-strip\"]'), 15000, 'strip renders');",
  "  const phase = await pageA.getByTestId('money-strip').getAttribute('data-phase');",
  "  console.log('settled strip phase=' + phase);",
  "  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-settled.png' });",
  "  console.log('corridor-dispute: settled shot PASS');",
].join("\n");
fs.writeFileSync(
  "scripts/corridor-dispute.mjs",
  head + "\n" + scenario + "\n" + shots + "\n" + scenario2 + "\n" + shots2 + "\n" + tail + "\n",
);
console.log("written ok");
