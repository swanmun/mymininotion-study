import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// jsdom에는 Next.js 라우터가 없으므로 next/navigation만 모킹한다 (헌법 기술 스택 절).
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// 로그인은 Supabase를 거치므로 로그인된 상태만 흉내 낸다.
vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  useStore: () => ({
    ready: true,
    user: { id: "u1", email: "a@b.c", nickname: "문", avatarUrl: null, createdAt: 0 },
    pages: [],
  }),
}));

const { default: WorkspaceLayout } = await import("./layout");

describe("사이드바 접기/펼치기", () => {
  it("버튼을 누르면 접히고, 다시 누르면 펼쳐진다", async () => {
    const user = userEvent.setup();
    render(<WorkspaceLayout>본문</WorkspaceLayout>);
    expect(screen.getByPlaceholderText("/page 입력 후 Enter")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "사이드바 접기" }));
    expect(screen.queryByPlaceholderText("/page 입력 후 Enter")).not.toBeInTheDocument();
    expect(screen.queryByText("문")).not.toBeInTheDocument();
    const expand = screen.getByRole("button", { name: "사이드바 펼치기" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveFocus();
    expect(screen.getByText("본문")).toBeInTheDocument();

    await user.click(expand);
    expect(screen.getByPlaceholderText("/page 입력 후 Enter")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "사이드바 접기" })).toHaveAttribute("aria-expanded", "true");
  });
});
