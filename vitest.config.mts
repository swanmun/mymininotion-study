import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json의 "@/*" 경로 별칭을 그대로 쓴다.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".specify", ".claude"],
    // 테스트마다 vi.fn / vi.spyOn 기록과 구현을 원래대로 되돌린다.
    restoreMocks: true,
    passWithNoTests: true,
  },
});
