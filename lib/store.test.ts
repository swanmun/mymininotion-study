import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, TEST_USER_ID } from "@/lib/testing/fakeSupabase";

// 글은 Supabase page 테이블에 저장된다. getSupabase를 메모리 DB로 바꿔 store의 공개 API만 쓴다.
let mockDb = createFakeSupabase();
vi.mock("@/lib/supabase", () => ({ getSupabase: () => mockDb.client }));

const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const row = (id: string, user_id: string, title: string, created_at = "2026-10-01T00:00:00Z") => ({
  id,
  user_id,
  title,
  content: "",
  created_at,
});

beforeEach(() => {
  mockDb = createFakeSupabase();
});

// 새 store 모듈을 받아 로그인(INITIAL_SESSION)과 글 목록 불러오기가 끝날 때까지 기다린다.
async function signedInStore() {
  vi.resetModules();
  const store = await import("@/lib/store");
  const { result } = renderHook(() => store.useStore());
  await waitFor(() => expect(result.current.user).not.toBeNull());
  return { store, state: () => result.current };
}

describe("글 저장 (Supabase page 테이블)", () => {
  it("로그인 후 내 글만 불러오고, 다른 사람 글은 목록에 없다", async () => {
    mockDb.tables.page.push(
      row("mine-old", TEST_USER_ID, "내 예전 글", "2026-10-01T00:00:00Z"),
      row("theirs", OTHER_USER_ID, "남의 글"),
      row("mine-new", TEST_USER_ID, "내 새 글", "2026-10-02T00:00:00Z"),
    );
    const { state } = await signedInStore();
    expect(state().pages.map((p) => p.id)).toEqual(["mine-new", "mine-old"]);
    expect(state().pagesError).toBe(false);
  });

  it("새 글은 로그인한 사용자 소유로 DB에 만들어지고 목록 맨 앞에 들어간다", async () => {
    const { store, state } = await signedInStore();
    const { data: page, error } = await store.createPage();
    expect(error).toBeNull();
    expect(mockDb.tables.page).toEqual([expect.objectContaining({ id: page!.id, user_id: TEST_USER_ID, title: "", content: "" })]);
    await waitFor(() => expect(state().pages[0].id).toBe(page!.id));
  });

  it("고친 제목·내용은 DB에 저장되어 다시 불러와도 남아 있다", async () => {
    const first = await signedInStore();
    const { data: page } = await first.store.createPage();
    expect(await first.store.updatePage(page!.id, { title: "회의 메모", content: "안건" })).toEqual({ data: null, error: null });

    const reloaded = await signedInStore();
    expect(reloaded.state().pages).toEqual([expect.objectContaining({ id: page!.id, title: "회의 메모", content: "안건" })]);
  });

  it("내 글을 지우면 DB와 목록에서 모두 사라진다", async () => {
    mockDb.tables.page.push(row("mine", TEST_USER_ID, "지울 글"));
    const { store, state } = await signedInStore();
    expect(await store.deletePage("mine")).toEqual({ data: null, error: null });
    expect(mockDb.tables.page).toEqual([]);
    await waitFor(() => expect(state().pages).toEqual([]));
  });

  it("다른 사람 글은 지우거나 고칠 수 없다", async () => {
    mockDb.tables.page.push(row("theirs", OTHER_USER_ID, "남의 글"));
    const { store } = await signedInStore();
    expect((await store.deletePage("theirs")).error).not.toBeNull();
    expect((await store.updatePage("theirs", { title: "바꿈" })).error).not.toBeNull();
    expect(mockDb.tables.page).toEqual([expect.objectContaining({ id: "theirs", title: "남의 글" })]);
  });
});
