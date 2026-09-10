import fs from "node:fs";
const L = fs.readFileSync("scripts/e2e-wave.mjs", "utf8").split("\n");
const head = L.slice(0, 150).join("\n");
const stepA = L.slice(151, 161).join("\n");
const tail = L.slice(321, 329).join("\n");
const shots = [
  "  await pageA.getByTestId('haggle-table').scrollIntoViewIfNeeded();",
  "  await pageA.waitForTimeout(300);",
  "  await pageA.getByTestId('haggle-table').screenshot({ path: 'docs/shot/p3-haggle-table.png' });",
  "  await pageA.getByTestId('haggle-confirm').scrollIntoViewIfNeeded();",
  "  await pageA.waitForTimeout(300);",
  "  await pageA.getByTestId('haggle-confirm').screenshot({ path: 'docs/shot/p3-haggle-confirm.png' });",
  "  assert.equal(await pageA.getByTestId('haggle-table').count(), 1, 'haggle table renders');",
  "  assert.equal(await pageA.getByTestId('haggle-confirm').count(), 1, 'haggle confirm renders');",
  "  console.log('corridor-haggle: 2 shots PASS');",
].join("\n");
fs.writeFileSync("scripts/corridor-haggle.mjs", head + "\n" + stepA + "\n" + shots + "\n" + tail + "\n");
console.log("written ok");
