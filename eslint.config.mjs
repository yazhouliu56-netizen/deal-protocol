import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 2026-08-22 Lint 回锁战役：融合期降级窗口关闭，13 条核心规则全部恢复
      // error 强制门禁（存量告警已全量清零，见 docs/LINT-CAMPAIGN-20260822-SNAPSHOT.txt）。
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-this-alias": "error",
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
      }],
      "react/no-unescaped-entities": "error",
      "prefer-const": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
      "react-hooks/purity": "error",
      "react-hooks/preserve-manual-memoization": "error",
      // 2026-08-23 Step 0 卫生战役：no-console 防回潮门禁（保留 warn/error 通道）
      "no-console": ["error", { "allow": ["warn", "error"] }],
    },
  },
  {
    // 2026-08-23 Step 0：no-console 门禁豁免面（三类合法 console 使用域）：
    // ① scripts/e2e —— CLI 与 E2E 工具，console 即产品输出通道；
    // ② 测试文件 —— node:test/vitest 诊断输出；
    // ③ src/lib、src/modules —— 旧宇宙（deal-protocol 协议系统）
    //    临期豁免，整体判死于 Step 1 清场战役，不再投入美容工时；
    //    Step 1 执行 git rm 时须同步删除本 override 块。
    files: [
      "scripts/**",
      "e2e/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "src/lib/**",
      "src/modules/**",
    ],
    rules: {
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".opencode/**",
    "mobile/**",
    // 构建产物：Serwist 由 src/app/sw.ts 编译生成，禁止 lint 扫描
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
  ]),

  {
    // Microkernel 2.0 战役 2 · 底座纯度物理门禁（红线 3 机器可验化）：
    // src/base/** 绝对纯核——禁 Supabase / 禁 adapters 反向 / 禁浏览器与
    // 设备全局。IO 一律经 src/adapters/ 组合根注入。
    files: ["src/base/**/*.ts", "src/base/**/*.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@supabase/*", "**/@supabase/*"], "message": "底座零 Supabase：DB/Realtime 访问请走 src/adapters/ 注入。" },
          { "group": ["@/adapters/*", "**/adapters/*"], "message": "红线 3 反向依赖：base 严禁 import adapters，改经端口注入。" }
        ]
      }],
      "no-restricted-globals": ["error",
        { "name": "window", "message": "底座纯度：浏览器全局禁止直用，信号经参数注入。" },
        { "name": "document", "message": "底座纯度：DOM 禁止直用，经 src/adapters/。" },
        { "name": "navigator", "message": "底座纯度：设备 API 禁止直用，经 src/adapters/。" },
        { "name": "localStorage", "message": "底座纯度：存储禁止直用，经端口注入。" },
        { "name": "sessionStorage", "message": "底座纯度：存储禁止直用，经端口注入。" },
        { "name": "MediaRecorder", "message": "底座纯度：硬件 API 禁止直用，经 src/adapters/device/。" },
        { "name": "fetch", "message": "底座纯度：网络 I/O 禁止直用，经 src/adapters/ 注入。" }
      ]
    }
  },
]);

export default eslintConfig;
