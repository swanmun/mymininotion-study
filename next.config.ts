import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next dev가 CLAUDE.md에 에이전트 안내 블록을 자동으로 추가하지 않게 한다.
  agentRules: false,
};

export default nextConfig;
