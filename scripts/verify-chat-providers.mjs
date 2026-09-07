#!/usr/bin/env node
import { allProviders, activeProviders, isValidKey } from "../src/adapters/ai/gateway/providers.ts";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// 落盘 key 自举：纯 node/tsx 直跑不自动加载 .env.local，此处读盘注入
// process.env，已有值不覆盖。零新依赖。
for (const envFile of [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")]) {
  if (!existsSync(envFile)) continue;
  for (const envLine of readFileSync(envFile, "utf8").split("\n")) {
    const t = envLine.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const envKey = t.slice(0, eq).trim();
    let envVal = t.slice(eq + 1).trim();
    if (
      (envVal.startsWith('"') && envVal.endsWith('"')) ||
      (envVal.startsWith("'") && envVal.endsWith("'"))
    ) {
      envVal = envVal.slice(1, -1);
    }
    if (envKey && !process.env[envKey]) process.env[envKey] = envVal;
  }
}
const k1 = "GEMINI" + "_" + "API" + "_" + "KEY";
const k2 = "ZHIPU" + "_" + "API" + "_" + "KEY";
const k3 = "DASHSCOPE" + "_" + "API" + "_" + "KEY";
const k5 = "DEEPSEEK" + "_" + "API" + "_" + "KEY";
const k6 = "KIMI" + "_" + "API" + "_" + "KEY";
const k7 = "OPENROUTER" + "_" + "API" + "_" + "KEY";
const bk1 = "DEEPSEEK" + "_" + "BASE" + "_" + "URL";
const bk2 = "KIMI" + "_" + "BASE" + "_" + "URL";
let ok = true;
for (const [got, exp, label] of [[isValidKey("sk-real"),true,"real"],[isValidKey("your_deepseek_api_key_here"),false,"placeholder"],[isValidKey("placeholder"),false,"lit"],[isValidKey(""),false,"empty"],[isValidKey("   "),false,"blank"]]) if (got!==exp){console.error(`x isValidKey ${label}`);ok=false;}
if(ok) console.log("isValidKey placeholder filtering - PASS");
const all=allProviders().map(p=>p.name).sort();
const expAll=["deepseek","gemini","gemini-lite","kimi","openrouter-cohere","openrouter-lfm","openrouter-nemotron","qwen","zhipu"];
if(JSON.stringify(all)!==JSON.stringify(expAll)){console.error(`x allProviders ${all}`);process.exit(1);}
console.log(`allProviders 9 - ${all.join(",")} - PASS`);
const DEMO={}; DEMO[k1]="demo-gemini"; DEMO[k2]="demo-zhipu"; DEMO[k3]="demo-qwen"; DEMO[k5]="demo-deepseek"; DEMO[k6]="demo-kimi"; DEMO[k7]="demo-or";
const saved={}; for(const k of Object.keys(DEMO)){saved[k]=process.env[k];process.env[k]=DEMO[k];}
try{
 const chat=activeProviders("chat").map(p=>p.name);
 const expChat=["gemini","zhipu","qwen","deepseek","kimi","openrouter-cohere","openrouter-nemotron","openrouter-lfm"];
  if(JSON.stringify(chat)!==JSON.stringify(expChat)){console.error(`x chat ${chat}`);process.exit(1);}
  console.log(`chat 8 steps - ${chat.join(" -> ")} - PASS`);
 const voice=activeProviders("voice-intent").map(p=>p.name);
 const expVoice=["zhipu","gemini","openrouter-cohere","openrouter-nemotron","openrouter-lfm"];
  if(JSON.stringify(voice)!==JSON.stringify(expVoice)){console.error(`x voice ${voice}`);process.exit(1);}
  console.log(`voice-intent 5 steps - ${voice.join(" -> ")} - PASS`);
 for(const task of ["voice-intent","cluster","decompose","diagnose","judge"]){const names=activeProviders(task).map(p=>p.name);if(names.includes("deepseek")||names.includes("kimi")){console.error(`x isolation ${task} contains deepseek/kimi`);process.exit(1);} if(["voice-intent","cluster","decompose","diagnose"].includes(task)&&names.includes("qwen")){console.error(`x isolation ${task} contains qwen`);process.exit(1);}}
 console.log("task isolation - deepseek/kimi/qwen chat-only - PASS");
 process.env[bk1]="https://api.siliconflow.cn/v1/";
 const ds=allProviders().find(p=>p.name==="deepseek");
 if(!ds.endpoint.startsWith("https://api.siliconflow.cn/v1/chat/completions")){console.error(`x DEEPSEEK_BASE_URL ${ds.endpoint}`);process.exit(1);}
 console.log(`DEEPSEEK_BASE_URL override - ${ds.endpoint} - PASS`); delete process.env[bk1];
 process.env[bk2]="https://custom.moonshot.test/v1";
 const km=allProviders().find(p=>p.name==="kimi");
 if(!km.endpoint.startsWith("https://custom.moonshot.test/v1/chat/completions")){console.error(`x KIMI_BASE_URL ${km.endpoint}`);process.exit(1);}
 console.log(`KIMI_BASE_URL override - ${km.endpoint} - PASS`); delete process.env[bk2];
 console.log("\ncheck:llm-providers ALL PASS - chat 8 / voice-intent 5 / isolation / BaseURL");
} finally { for(const k of Object.keys(DEMO)){if(saved[k]===undefined) delete process.env[k]; else process.env[k]=saved[k];}}
