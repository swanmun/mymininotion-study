"use client";

// Auth is real Google sign-in through Supabase (F-01~04), and the profile
// (nickname, image) lives in the Supabase profile table (F-05~06). Pages are
// still local-first: persisted in localStorage, one key per account, so two
// Google accounts on the same browser never see each other's pages.
// The pages only use the exported API.
import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getSupabase } from "./supabase";

export type User = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: number;
};

export type Page = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type State = { ready: boolean; user: User | null; pages: Page[] };
type Saved = { profile: Pick<User, "nickname" | "avatarUrl">; pages: Page[] };

const KEY_PREFIX = "mini-notion:v2:";
const SERVER_STATE: State = { ready: false, user: null, pages: [] };

let state: State = SERVER_STATE;
let started = false;
let sessionSeq = 0;
const listeners = new Set<() => void>();

const keyFor = (userId: string) => KEY_PREFIX + userId;

function readSaved(userId: string): Saved | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: Omit<State, "ready">) {
  state = { ...state, ...next };
  if (next.user) {
    const saved: Saved = {
      profile: { nickname: next.user.nickname, avatarUrl: next.user.avatarUrl },
      pages: next.pages,
    };
    try {
      localStorage.setItem(keyFor(next.user.id), JSON.stringify(saved));
    } catch {
      // Storage full or blocked — keep the in-memory state so the session still works.
    }
  }
  emit();
}

// Google display name from the auth user's metadata, cut to the nickname limit.
function displayNameOf(au: Session["user"]) {
  const meta = au.user_metadata ?? {};
  return String(meta.display_name || meta.full_name || meta.name || au.email?.split("@")[0] || "").slice(0, 20);
}

type ProfileRow = { name: string | null; avatar_url: string | null };
const PROFILE_COLUMNS = "name, avatar_url";

// Returns the user's 1:1 profile row. The DB trigger creates it on first
// sign-in with name = display name; if it is somehow missing, create it here.
async function ensureProfile(au: Session["user"]): Promise<ProfileRow | null> {
  const supabase = getSupabase()!;
  const { data } = await supabase.from("profile").select(PROFILE_COLUMNS).eq("user_id", au.id).maybeSingle();
  if (data) return data;
  const { data: created } = await supabase
    .from("profile")
    .upsert({ user_id: au.id, name: displayNameOf(au) }, { onConflict: "user_id", ignoreDuplicates: true })
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  return created;
}

// Builds the app user from a Supabase session. First login on this browser
// seeds sample pages; nickname and image come from the profile row (name is
// seeded with the Google display name on first login).
async function applySession(session: Session | null) {
  const seq = ++sessionSeq;
  if (!session) {
    state = { ready: true, user: null, pages: [] };
    return emit();
  }
  const au = session.user;
  if (state.ready && state.user?.id === au.id) {
    if (state.user.email !== au.email) commit({ user: { ...state.user, email: au.email ?? "" }, pages: state.pages });
    return;
  }

  const profile = await ensureProfile(au);
  if (seq !== sessionSeq) return; // a newer auth event already won

  const meta = au.user_metadata ?? {};
  const saved = readSaved(au.id);
  const googleName = displayNameOf(au);
  const now = Date.now();
  state = { ...state, ready: true };
  commit({
    user: {
      id: au.id,
      email: au.email ?? "",
      nickname: profile?.name || saved?.profile.nickname || googleName,
      avatarUrl: profile?.avatar_url || saved?.profile.avatarUrl || meta.avatar_url || meta.picture || null,
      createdAt: Date.parse(au.created_at) || now,
    },
    pages: saved?.pages ?? seedPages(now),
  });
}

function start() {
  if (started) return;
  started = true;
  const supabase = getSupabase();
  if (!supabase) {
    // No Supabase config: show the signed-out screens instead of a blank page.
    state = { ...state, ready: true };
    return;
  }
  // Fires INITIAL_SESSION on load (after any ?code= exchange), then on every
  // sign-in / sign-out, including ones from other tabs. Supabase calls must not
  // run inside this callback, so the work is deferred.
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => void applySession(session), 0);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!state.user || e.key !== keyFor(state.user.id)) return;
    const saved = readSaved(state.user.id);
    if (!saved) return;
    state = { ...state, user: { ...state.user, ...saved.profile }, pages: saved.pages };
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

const uid = () => Math.random().toString(16).slice(2, 8);

function seedPages(now: number): Page[] {
  const min = 60_000;
  const day = 86_400_000;
  return [
    {
      title: "회의 메모",
      content:
        "9월 넷째 주 주간 회의\n\n- 구글 로그인 연결 완료, 배포 환경 확인\n- 자동 저장 간격은 1초로 유지\n- 다음 주: 마이 페이지 별명 변경부터 시작\n\n질문: 휴지통 기능이 정말 필요 없는지 2주 써 보고 결정",
      ago: 5 * min,
    },
    { title: "할 일 목록", content: "- PRD 검토\n- 디자인 목업 확인\n- Next.js 프로젝트 만들기", ago: 3 * 60 * min },
    { title: "아이디어", content: "/todo 명령어, 글 검색, 다크 모드", ago: day },
    { title: "읽을거리", content: "", ago: 4 * day },
  ].map(({ ago, ...p }) => ({ id: uid(), ...p, createdAt: now - ago, updatedAt: now - ago }));
}

// F-01: real Google sign-in. Leaves the app for Google, then Supabase sends the
// browser back to /login, where the session is picked up and the user is moved
// on to /pages. On first login the profile row is created by a DB trigger
// (with a client-side fallback in ensureProfile).
export async function signIn(): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: "로그인 설정이 없습니다." };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/login` },
  });
  return { error: error ? error.message : null };
}

// F-04
export async function signOut() {
  await getSupabase()?.auth.signOut();
  await applySession(null);
}

// Writes to the signed-in user's profile row, then mirrors it into the store.
async function saveProfile(patch: Partial<ProfileRow>): Promise<{ error: string | null }> {
  const user = state.user;
  const supabase = getSupabase();
  if (!user || !supabase) return { error: "로그인 설정이 없습니다." };
  const { data, error } = await supabase
    .from("profile")
    .update(patch)
    .eq("user_id", user.id)
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? "profile row not found" };
  if (state.user?.id !== user.id) return { error: null }; // signed out meanwhile
  commit({
    user: { ...state.user, nickname: data.name || state.user.nickname, avatarUrl: data.avatar_url || state.user.avatarUrl },
    pages: state.pages,
  });
  return { error: null };
}

// F-05
export function saveNickname(nickname: string) {
  return saveProfile({ name: nickname });
}

// F-06: the file goes to Storage at avatars/<user id>/avatar (overwritten on
// each change); the public URL, with a version to bust caches, goes to profile.
export async function saveAvatar(file: File): Promise<{ error: string | null }> {
  const user = state.user;
  const supabase = getSupabase();
  if (!user || !supabase) return { error: "로그인 설정이 없습니다." };
  const bucket = supabase.storage.from("avatars");
  const path = `${user.id}/avatar`;
  const { error } = await bucket.upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
  if (error) return { error: error.message };
  const { publicUrl } = bucket.getPublicUrl(path).data;
  return saveProfile({ avatar_url: `${publicUrl}?v=${Date.now()}` });
}

// F-07
export function createPage(): Page {
  const s = state;
  const now = Date.now();
  const page: Page = { id: uid(), title: "", content: "", createdAt: now, updatedAt: now };
  commit({ user: s.user, pages: [page, ...s.pages] });
  return page;
}

// F-10
export function updatePage(id: string, patch: Partial<Pick<Page, "title" | "content">>) {
  const s = state;
  commit({
    user: s.user,
    pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
  });
}

// F-11
export function deletePage(id: string) {
  const s = state;
  commit({ user: s.user, pages: s.pages.filter((p) => p.id !== id) });
}

// F-08: most recently edited first.
export function sortPages(pages: Page[]) {
  return [...pages].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const displayTitle = (p: Page) => p.title.trim() || "제목 없음";

const pad = (n: number) => String(n).padStart(2, "0");

/** List timestamp: 방금 · HH:MM (today) · 어제 · MM.DD */
export function shortTime(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (now - ts < 60_000) return "방금";
  if (ts >= today.getTime()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (ts >= today.getTime() - 86_400_000) return "어제";
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** Header timestamp: 오늘 14:32 · 09.24 14:32 */
export function savedTime(ts: number) {
  const d = new Date(ts);
  const isToday = new Date().toDateString() === d.toDateString();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return isToday ? `오늘 ${hm}` : `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${hm}`;
}

export function fullDate(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
