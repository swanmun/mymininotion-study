import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom에는 Next.js 라우터가 없으므로 next/navigation만 모킹한다 (헌법 기술 스택 절).
let currentId = "";
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: currentId }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

beforeEach(() => {
  currentId = "";
});

// store 모듈은 상태를 모듈 안에 캐시하므로 매번 새 모듈을 받아 실제 공개 API로 글을 준비한다.
async function renderPage(content: string) {
  vi.resetModules();
  const { createPage, updatePage } = await import("@/lib/store");
  const page = createPage();
  updatePage(page.id, { content });
  currentId = page.id;
  const { default: PageDetail } = await import("./page");
  return render(<PageDetail />);
}

const body = () => screen.getByPlaceholderText("여기에 내용을 입력하세요...");

describe("글 상세 화면 글자 수", () => {
  it("빈 글을 열면 0자로 보인다", async () => {
    await renderPage("");
    expect(screen.getByText("글자 수 0 · 공백 제외 0")).toBeInTheDocument();
  });

  it("저장된 내용이 있으면 입력 없이 그 글자 수가 보인다", async () => {
    await renderPage("회의 메모");
    expect(screen.getByText("글자 수 5 · 공백 제외 4")).toBeInTheDocument();
  });

  it("입력·삭제하면 저장을 기다리지 않고 바로 바뀐다", async () => {
    const user = userEvent.setup();
    await renderPage("");
    await user.type(body(), "안녕 하세요");
    expect(screen.getByText("글자 수 6 · 공백 제외 5")).toBeInTheDocument();
    await user.type(body(), "{Backspace}");
    expect(screen.getByText("글자 수 5 · 공백 제외 4")).toBeInTheDocument();
  });

  it("줄바꿈은 공백 포함에서 1자, 공백 제외에서 0자로 센다", async () => {
    const user = userEvent.setup();
    await renderPage("");
    await user.type(body(), "가 나{Enter}다");
    expect(screen.getByText("글자 수 5 · 공백 제외 3")).toBeInTheDocument();
  });

  it("공백만 있으면 공백 제외 글자 수는 0이다", async () => {
    await renderPage("   ");
    expect(screen.getByText("글자 수 3 · 공백 제외 0")).toBeInTheDocument();
  });

  it("글자 수는 내용 입력칸 바로 아래에 있다", async () => {
    await renderPage("회의 메모");
    expect(body().nextElementSibling).toBe(screen.getByText("글자 수 5 · 공백 제외 4"));
  });

  it("1,000자 이상은 세 자리마다 쉼표를 넣는다", async () => {
    await renderPage("가".repeat(1234));
    expect(screen.getByText("글자 수 1,234 · 공백 제외 1,234")).toBeInTheDocument();
  });

  it("공백 제외 글자 수도 1,000 이상이면 쉼표를 넣는다", async () => {
    await renderPage("가".repeat(1000) + " ");
    expect(screen.getByText("글자 수 1,001 · 공백 제외 1,000")).toBeInTheDocument();
  });

  it("글을 찾을 수 없는 화면에서는 글자 수를 보이지 않는다", async () => {
    vi.resetModules();
    currentId = "없는-글";
    const { default: PageDetail } = await import("./page");
    render(<PageDetail />);
    expect(screen.getByText("글을 찾을 수 없습니다")).toBeInTheDocument();
    expect(screen.queryByText(/글자 수/)).not.toBeInTheDocument();
  });
});
