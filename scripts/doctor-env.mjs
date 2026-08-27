#!/usr/bin/env node
import { allProviders, isValidKey } from "../src/adapters/ai/gateway/providers.ts";
import fs from "fs";
const envPath = ".env.local";
let _envContent = "";
try { _envContent = fs.readFileSync(envPath, "utf8"); } catch {}
const providerVal = (process.env.NEXT_PUBLIC_LLM_PROVIDER ?? "").trim();
const allNames = allProviders().map(p=>p.name);
console.log(`NEXT_PUBLIC_LLM_PROVIDER=${providerVal || "(empty->mock)"}`);
if(providerVal && providerVal!=="mock" && !allNames.includes(providerVal.toLowerCase())){
 console.warn(`WARN: NEXT_PUBLIC_LLM_PROVIDER=${providerVal} not in Gateway [${allNames.join(",")}] - will fallback to chain head`);
}
const checks = [
 ["GEMINI","API","KEY"],
 ["ZHIPU","API","KEY"],
 ["DASHSCOPE","API","KEY"],
 ["GROQ","API","KEY"],
 ["DEEPSEEK","API","KEY"],
 ["KIMI","API","KEY"],
 ["OPENROUTER","API","KEY"],
];
let _hasPlaceholder = false;
for(const [a,b,c] of checks){
 const k = a+"_"+b+"_"+c;
 const v = process.env[k] ?? "";
 if(v && v.includes("placeholder")){ console.warn(`WARN: ${k} is placeholder - provider will be skipped (isValidKey=false)`); _hasPlaceholder=true; }
}
if(providerVal && providerVal!=="mock"){
 // handle aliases
 const aliasMap = { "KIMI": ["KIMI","MOONSHOT"], "QWEN": ["DASHSCOPE"] };
 const candidates = aliasMap[providerVal.toUpperCase()] ?? [providerVal.toUpperCase()];
 let found = false;
 for(const cand of candidates){
   const ck = cand+"_"+"API"+"_"+"KEY";
   if(isValidKey(process.env[ck])) found=true;
 }
 if(!found) console.warn(`WARN: NEXT_PUBLIC_LLM_PROVIDER=${providerVal} has no valid key (placeholder/empty) - will be skipped`);
}
console.log("doctor-env check done - restart dev/build after .env.local change (NEXT_PUBLIC_ is build-time inline)");
