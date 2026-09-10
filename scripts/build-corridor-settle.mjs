import fs from "node:fs";
const raw = fs.readFileSync("scripts/e2e-acceptance.mjs", "utf8");
const L = raw.split("\n");
const head = L.slice(0, 71).join("\n");
const scenario = L.slice(71, 159).join("\n");
const tail = L.slice(374, 382).join("\n");
const clickTrip = L[315].trim();
const shots = [
  "  await pageA.reload({ waitUntil: 'domcontentloaded' });",
  "  " + clickTrip,
  "  await pageA.waitForTimeout(500);",
  "  await waitUntil(pageA, () => { const el = document.querySelector('[data-testid=\"money-strip\"]'); return el && (el.getAttribute('data-phase') === 'settled' || el.getAttribute('data-phase') === 'review'); }, 15000, 'strip settled/review');",
  "  const phaseN = await pageA.getByTestId('money-strip').getAttribute('data-phase');",
  "  console.log('normal settle strip phase=' + phaseN);",
  "  await pageA.getByTestId('money-strip').screenshot({ path: 'docs/shot/p2-money-review.png' });",
  "  console.log('corridor-settle: 1 shot PASS');",
].join("\n");
fs.writeFileSync(
  "scripts/corridor-settle.mjs",
  head + "\n" + scenario + "\n" + shots + "\n" + tail + "\n",
);
console.log("written ok");
