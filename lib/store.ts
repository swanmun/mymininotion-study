"use client";

// Auth is real Google sign-in through Supabase (F-01~04), the profile
// (nickname, image, introduction) lives in the Supabase profile table (F-05~06), and pages
// live in the Supabase page table (F-07~11). RLS limits every page query to
// the signed-in user's own rows. localStorage only caches the profile.
// The pages only use the exported API.
import type { Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { getSupabase } from "./supabase";

export type User = {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  /** Self-introduction; "" when not set. */
  intro: string;
  createdAt: number;
};

export type Page = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

// pagesError: the page list could not be loaded from Supabase.
type State = { ready: boolean; user: User | null; pages: Page[]; pagesError: boolean };
// intro is optional: data saved before the introduction field has no such key.
type Saved = { profile: Pick<User, "nickname" | "avatarUrl"> & { intro?: string } };

const KEY_PREFIX = "mini-notion:v2:";
const SERVER_STATE: State = { ready: false, user: null, pages: [], pagesError: false };

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

function commit(next: Partial<Omit<State, "ready">>) {
  state = { ...state, ...next };
  if (next.user) {
    const saved: Saved = {
      profile: { nickname: next.user.nickname, avatarUrl: next.user.avatarUrl, intro: next.user.intro },
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

type ProfileRow = { name: string | null; avatar_url: string | null; introduction: string | null };
const PROFILE_COLUMNS = "name, avatar_url, introduction";

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

type PageRow = { id: string; title: string; content: string; created_at: string };
const PAGE_COLUMNS = "id, title, content, created_at";

// The page table has no updated_at column, so the edit time is only known for
// edits made in this session; loaded pages start from their creation time.
function toPage(row: PageRow): Page {
  const createdAt = Date.parse(row.created_at) || Date.now();
  return { id: row.id, title: row.title, content: row.content, createdAt, updatedAt: createdAt };
}

async function loadPages(userId: string): Promise<Page[] | null> {
  const { data, error } = await getSupabase()!
    .from("page")
    .select(PAGE_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return error ? null : (data as PageRow[]).map(toPage);
}

// Builds the app user from a Supabase session. Nickname and image come from
// the profile row (name is seeded with the Google display name on first
// login); pages come from the page table.
async function applySession(session: Session | null) {
  const seq = ++sessionSeq;
  if (!session) {
    state = { ready: true, user: null, pages: [], pagesError: false };
    return emit();
  }
  const au = session.user;
  if (state.ready && state.user?.id === au.id) {
    if (state.user.email !== au.email) commit({ user: { ...state.user, email: au.email ?? "" } });
    return;
  }

  const [profile, pages] = await Promise.all([ensureProfile(au), loadPages(au.id)]);
  if (seq !== sessionSeq) return; // a newer auth event already won

  const meta = au.user_metadata ?? {};
  const saved = readSaved(au.id);
  const googleName = displayNameOf(au);
  state = { ...state, ready: true };
  commit({
    user: {
      id: au.id,
      email: au.email ?? "",
      nickname: profile?.name || saved?.profile.nickname || googleName,
      avatarUrl: profile?.avatar_url || saved?.profile.avatarUrl || meta.avatar_url || meta.picture || null,
      // An empty introduction in the row is a real value, so only fall back when the row is missing.
      intro: (profile ? profile.introduction : saved?.profile.intro) ?? "",
      createdAt: Date.parse(au.created_at) || Date.now(),
    },
    pages: pages ?? [],
    pagesError: !pages,
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
    state = { ...state, user: { ...state.user, ...saved.profile } };
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
    user: {
      ...state.user,
      nickname: data.name || state.user.nickname,
      avatarUrl: data.avatar_url || state.user.avatarUrl,
      intro: data.introduction ?? "",
    },
  });
  return { error: null };
}

// F-05
export function saveNickname(nickname: string) {
  return saveProfile({ name: nickname });
}

// Self-introduction. An empty string clears it (stored as null).
export function saveIntro(intro: string) {
  return saveProfile({ introduction: intro || null });
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

type Result<T = null> = { data: T | null; error: string | null };

// Page writes run one after another, so a slow earlier autosave can never land
// after (and overwrite) a newer one, and an edit never races its page's insert.
let writes: Promise<unknown> = Promise.resolve();
function queueWrite<T>(run: () => Promise<T>): Promise<T> {
  const next = writes.then(run, run);
  writes = next.catch(() => {});
  return next;
}

// F-07: inserts an empty page owned by the signed-in user, then adds it to the list.
export function createPage(): Promise<Result<Page>> {
  return queueWrite(async () => {
    const user = state.user;
    const supabase = getSupabase();
    if (!user || !supabase) return { data: null, error: "로그인 설정이 없습니다." };
    const { data, error } = await supabase
      .from("page")
      .insert({ user_id: user.id, title: "", content: "" })
      .select(PAGE_COLUMNS)
      .single();
    if (error || !data) return { data: null, error: error?.message ?? "page not created" };
    const page = toPage(data as PageRow);
    if (state.user?.id === user.id) commit({ pages: [page, ...state.pages] });
    return { data: page, error: null };
  });
}

// F-10: updates the list right away, then writes to the page table.
export function updatePage(id: string, patch: Partial<Pick<Page, "title" | "content">>): Promise<Result> {
  const user = state.user;
  commit({ pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) });
  return queueWrite(async () => {
    const supabase = getSupabase();
    if (!user || !supabase) return { data: null, error: "로그인 설정이 없습니다." };
    const { data, error } = await supabase
      .from("page")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    if (error) return { data: null, error: error.message };
    return { data: null, error: data.length ? null : "page not found" };
  });
}

// F-11: deletes the row first; the page leaves the list only once it is gone.
export function deletePage(id: string): Promise<Result> {
  return queueWrite(async () => {
    const user = state.user;
    const supabase = getSupabase();
    if (!user || !supabase) return { data: null, error: "로그인 설정이 없습니다." };
    const { data, error } = await supabase.from("page").delete().eq("id", id).eq("user_id", user.id).select("id");
    if (error) return { data: null, error: error.message };
    if (!data.length) return { data: null, error: "page not found" };
    if (state.user?.id === user.id) commit({ pages: state.pages.filter((p) => p.id !== id) });
    return { data: null, error: null };
  });
}

// F-12: light / dark workspace. A per-browser preference, so it lives under its
// own key rather than in an account's saved data.
export type Theme = "light" | "dark";

const THEME_KEY = "mini-notion:theme";
let theme: Theme | null = null;
const themeListeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, () => (theme ??= readTheme()), () => "light");
}

export function setTheme(next: Theme) {
  theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked — the choice still holds for this visit.
  }
  themeListeners.forEach((l) => l());
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
