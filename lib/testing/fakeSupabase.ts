// 테스트 전용: lib/supabase의 getSupabase를 대신하는 메모리 DB.
// store가 쓰는 만큼만 흉내 낸다 — from().select/insert/update/delete + eq/order/single/maybeSingle,
// storage.from(버킷).upload/remove, auth.onAuthStateChange(즉시 로그인 세션 전달)·signOut.
// RLS는 흉내 내지 않는다. 본인 글만 다루는지는 store가 거는 user_id 조건으로 확인한다.

type Row = Record<string, unknown>;

export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001";

export function createFakeSupabase(userId = TEST_USER_ID) {
  const tables: Record<string, Row[]> = { page: [], profile: [{ user_id: userId, name: "테스터", avatar_url: null, image_path: null }] };
  // 버킷 이름 → (버킷 안 경로 → 올린 파일). failUploads를 켜면 업로드가 실패한다.
  const buckets: Record<string, Map<string, File>> = {};
  const storageControl = { failUploads: false };
  let seq = 0;

  function from(table: string) {
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row = {};
    let returning = false;
    let one: "single" | "maybe" | null = null;
    let order: { col: string; asc: boolean } | null = null;
    const filters: [string, unknown][] = [];

    const run = () => {
      const rows = (tables[table] ??= []);
      const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
      let out: Row[];
      if (op === "insert") {
        const row = { id: `page-${++seq}`, created_at: new Date(Date.now() + seq).toISOString(), ...payload };
        rows.push(row);
        out = [row];
      } else if (op === "update") {
        out = rows.filter(match);
        out.forEach((r) => Object.assign(r, payload));
      } else if (op === "delete") {
        out = rows.filter(match);
        tables[table] = rows.filter((r) => !match(r));
      } else {
        out = rows.filter(match);
      }
      if (order) {
        const { col, asc } = order;
        out = [...out].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      if (op !== "select" && !returning) return { data: null, error: null };
      const data = out.map((r) => ({ ...r }));
      if (one === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "not single" } };
      if (one === "maybe") return { data: data[0] ?? null, error: null };
      return { data, error: null };
    };

    const q = {
      select: () => ((op === "select" ? null : (returning = true)), q),
      insert: (row: Row) => ((op = "insert"), (payload = row), q),
      upsert: (row: Row) => ((op = "insert"), (payload = row), q),
      update: (patch: Row) => ((op = "update"), (payload = patch), q),
      delete: () => ((op = "delete"), q),
      eq: (col: string, v: unknown) => (filters.push([col, v]), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), q),
      single: () => ((one = "single"), q),
      maybeSingle: () => ((one = "maybe"), q),
      then: <T>(resolve: (r: ReturnType<typeof run>) => T) => Promise.resolve(run()).then(resolve),
    };
    return q;
  }

  const session = { user: { id: userId, email: "tester@example.com", created_at: new Date().toISOString(), user_metadata: {} } };
  function bucket(name: string) {
    const files = (buckets[name] ??= new Map());
    return {
      upload: async (path: string, file: File, opts?: { upsert?: boolean }) => {
        if (storageControl.failUploads) return { data: null, error: { message: "upload failed" } };
        if (files.has(path) && !opts?.upsert) return { data: null, error: { message: "The resource already exists" } };
        files.set(path, file);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        paths.forEach((p) => files.delete(p));
        return { data: [], error: null };
      },
    };
  }

  const client = {
    from,
    storage: { from: bucket },
    auth: {
      onAuthStateChange: (cb: (event: string, s: typeof session) => void) => {
        cb("INITIAL_SESSION", session);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => ({ error: null }),
    },
  };
  return { client, tables, buckets, storageControl };
}
