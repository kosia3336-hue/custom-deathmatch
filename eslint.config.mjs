import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
      빌드 산출물. 위 "build/**" 는 최상위만 걸러서 하위 경로의 산출물이 그대로
      검사 대상이 됐다 — 남의 생성 코드라 고칠 수도 없는 오류만 결과에 쌓인다.
    */
    "**/build/**",
    "**/dist/**",
    ".next-*/**",
  ]),
]);

export default eslintConfig;
