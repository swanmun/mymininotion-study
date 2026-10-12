import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/store";

// jsdom에는 Next.js 라우터가 없으므로 next/navigation만 모킹한다 (헌법 기술 스택 절).
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// 테스트에는 Supabase 로그인이 없으므로 로그인된 상태와 저장 함수만 바꿔 끼운다.
const store = vi.hoisted(() => ({
  user: null as User | null,
  saveIntro: vi.fn(),
}));
vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  useStore: () => ({ ready: true, user: store.user, pages: [] }),
  saveIntro: store.saveIntro,
}));

const baseUser: User = {
  id: "u1",
  email: "a@example.com",
  nickname: "문",
  avatarUrl: "https://example.com/a.png",
  intro: "",
  createdAt: 0,
};

async function renderPage(intro = "") {
  store.user = { ...baseUser, intro };
  const { default: MyPage } = await import("./page");
  return render(<MyPage />);
}

const field = () => screen.getByLabelText("자기소개");
const introSave = () => screen.getAllByRole("button", { name: "저장" })[1];

beforeEach(() => {
  store.saveIntro.mockReset();
  store.saveIntro.mockImplementation(async (text: string) => {
    store.user = { ...store.user!, intro: text };
    return { error: null };
  });
});

describe("마이 페이지 자기소개", () => {
  it("저장된 자기소개를 입력칸과 제목 아래에 보여 준다", async () => {
    await renderPage("글 쓰는 개발자입니다.");
    expect(field()).toHaveValue("글 쓰는 개발자입니다.");
    expect(screen.getByText("글 쓰는 개발자입니다.", { selector: "p" })).toBeInTheDocument();
  });

  it("바뀐 내용이 없으면 저장 버튼이 꺼져 있다", async () => {
    await renderPage("그대로");
    expect(introSave()).toBeDisabled();
  });

  it("앞뒤 공백을 잘라 저장하고 완료 문구를 보여 준다", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.type(field(), "  안녕하세요  ");
    expect(screen.getByText("9 / 200")).toBeInTheDocument();
    await user.click(introSave());
    expect(store.saveIntro).toHaveBeenCalledWith("안녕하세요");
    expect(await screen.findByText("저장되었습니다.")).toBeInTheDocument();
    expect(field()).toHaveValue("안녕하세요");
  });

  it("Ctrl+Enter로 저장하고, Enter는 줄을 바꾼다", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.type(field(), "첫 줄{Enter}둘째 줄{Control>}{Enter}{/Control}");
    expect(store.saveIntro).toHaveBeenCalledTimes(1);
    expect(store.saveIntro).toHaveBeenCalledWith("첫 줄\n둘째 줄");
  });

  it("비우고 저장하면 빈 값으로 지운다", async () => {
    const user = userEvent.setup();
    await renderPage("지울 소개");
    await user.clear(field());
    await user.click(introSave());
    expect(store.saveIntro).toHaveBeenCalledWith("");
  });

  it("저장에 실패하면 에러 문구를 보여 준다", async () => {
    store.saveIntro.mockResolvedValue({ error: "network" });
    const user = userEvent.setup();
    await renderPage();
    await user.type(field(), "소개");
    await user.click(introSave());
    expect(await screen.findByRole("alert")).toHaveTextContent("자기소개를 저장하지 못했습니다.");
  });

  it("200자를 넘겨 입력할 수 없다", async () => {
    await renderPage();
    expect(field()).toHaveAttribute("maxLength", "200");
  });
});
