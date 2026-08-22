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
]);

export default eslintConfig;
