import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// jsdom에는 Next.js 라우터가 없으므로 next/navigation만 모킹한다 (헌법 기술 스택 절).
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// 업무 페이지는 로그인한 사용자에게만 보이므로, 외부 서비스인 Supabase만 로그인된 상태로 대신한다.
// store가 쓰는 호출(onAuthStateChange, profile 행 조회)과 같은 모양의 응답을 돌려준다.
vi.mock("@/lib/supabase", () => {
  const session = {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      aud: "authenticated",
      email: "user@example.com",
      app_metadata: { provider: "google" },
      user_metadata: { full_name: "테스트 사용자" },
      created_at: "2026-09-01T00:00:00.000Z",
    },
  };
  const client = {
    auth: {
      onAuthStateChange: (cb: (event: string, s: typeof session) => void) => {
        cb("INITIAL_SESSION", session);
        return { data: { subscription: { id: "sub", callback: cb, unsubscribe: () => {} } } };
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { name: "테스트 사용자", avatar_url: null }, error: null }),
        }),
      }),
    }),
  };
  return { AUTH_STORAGE_KEY: "mini-notion:auth", getSupabase: () => client };
});

// store 모듈은 상태를 모듈 안에 캐시하므로 매번 새 모듈로 화면을 그린다 (= 새로고침).
async function renderWorkspace() {
  vi.resetModules();
  const { default: WorkspaceLayout } = await import("./layout");
  render(
    <WorkspaceLayout>
      <p>본문</p>
    </WorkspaceLayout>,
  );
  return screen.findByRole("button", { name: "다크 모드" });
}

const workspaceOf = (el: HTMLElement) => el.closest(".ws")!;

describe("업무 페이지 다크 모드", () => {
  it("처음에는 밝은 화면이고 다크 모드 버튼은 눌리지 않은 상태다", async () => {
    const toggle = await renderWorkspace();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(workspaceOf(toggle)).toHaveAttribute("data-theme", "light");
  });

  it("다크 모드 버튼을 누르면 어두운 화면으로 바뀐다", async () => {
    const user = userEvent.setup();
    const toggle = await renderWorkspace();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(workspaceOf(toggle)).toHaveAttribute("data-theme", "dark");
  });

  it("한 번 더 누르면 밝은 화면으로 돌아온다", async () => {
    const user = userEvent.setup();
    const toggle = await renderWorkspace();
    await user.click(toggle);
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(workspaceOf(toggle)).toHaveAttribute("data-theme", "light");
  });

  it("새로고침해도 고른 화면이 유지된다", async () => {
    const user = userEvent.setup();
    await user.click(await renderWorkspace());
    cleanup();

    const toggle = await renderWorkspace();
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(workspaceOf(toggle)).toHaveAttribute("data-theme", "dark");
  });
});
