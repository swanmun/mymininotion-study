import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 테스트 전용 정리 작업은 여기(테스트 유틸)에 둔다. 제품 코드에 넣지 않는다.
// localStorage는 jsdom의 실제 구현을 쓰고 모킹하지 않는다. 테스트 사이 상태만 비운다.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
