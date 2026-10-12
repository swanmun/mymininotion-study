"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Avatar from "@/components/Avatar";
import RequireAuth from "@/components/RequireAuth";
import { Button, Input, Window } from "@/components/ds";
import { createPage, displayTitle, shortTime, sortPages, useStore } from "@/lib/store";

// 1b / 1c · 업무 페이지 — 사이드바(글 목록 + /page 명령) 공통 레이아웃
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="ws">
        <Sidebar />
        <main className="ws-main">{children}</main>
      </div>
    </RequireAuth>
  );
}

function Sidebar() {
  const { user, pages } = useStore();
  const { id: activeId } = useParams<{ id?: string }>();
  const router = useRouter();
  const [cmd, setCmd] = useState("");
  const [now, setNow] = useState(() => Date.now());

  // Keep the relative timestamps ("방금", "어제") fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sorted = sortPages(pages);
  const showPalette = cmd.startsWith("/");
  const matchesPage = "/page".startsWith(cmd.trim());

  // F-07: "/page" + Enter → new "제목 없음" page, opened immediately.
  const runPage = () => {
    const page = createPage();
    setCmd("");
    router.push(`/pages/${page.id}`);
  };

  return (
    <aside className="ws-side">
      <div className="ws-profile">
        <Avatar src={user!.avatarUrl} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ws-profile-name">{user!.nickname}</div>
          <Link href="/me" className="ws-profile-link">
            마이 페이지 →
          </Link>
        </div>
        <Button variant="window" size="sm" href="/me">
          설정
        </Button>
      </div>

      <div className="ws-section">
        <span>내 글</span>
        <span className="leader-line" />
        <span className="num">{String(pages.length).padStart(2, "0")}</span>
      </div>

      <nav className="ws-list">
        {sorted.length === 0 && <div className="ws-empty">아직 글이 없습니다.</div>}
        {sorted.map((p) => (
          <Link key={p.id} href={`/pages/${p.id}`} className={`ws-row${p.id === activeId ? " active" : ""}`}>
            <span className="ws-row-title">{displayTitle(p)}</span>
            <span className="ws-row-time">{shortTime(p.updatedAt, now)}</span>
          </Link>
        ))}
      </nav>

      <div className="ws-cmd">
        {showPalette && (
          <div className="ws-cmd-pop">
            <Window title="명령어" tone="white" padding={0}>
              {matchesPage ? (
                <div className="ws-cmd-item" onMouseDown={(e) => (e.preventDefault(), runPage())}>
                  <span style={{ fontWeight: 600 }}>/page</span>
                  <span style={{ flex: 1, opacity: 0.75 }}>새 글 만들기</span>
                  <span style={{ fontSize: 11 }}>Enter ↵</span>
                </div>
              ) : (
                <div className="ws-cmd-item dim">알 수 없는 명령어입니다</div>
              )}
              <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--fg-2)" }}>다른 명령어는 다음 버전에서</div>
            </Window>
          </div>
        )}
        <Input
          placeholder="/page 입력 후 Enter"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && cmd.trim() === "/page") runPage();
            if (e.key === "Escape") setCmd("");
          }}
        />
        <span className="hint">새 글은 &quot;제목 없음&quot;으로 만들어집니다.</span>
      </div>
    </aside>
  );
}
