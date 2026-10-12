"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Tag, Window } from "@/components/ds";
import { countChars } from "@/lib/charCount";
import { deletePage, displayTitle, savedTime, sortPages, updatePage, useStore, type Page } from "@/lib/store";

const AUTOSAVE_MS = 1000;
const CAT_URL = "https://cataas.com/cat/cute";

// Random cat banner above the title. Shows a shimmering skeleton until the image arrives.
function CatCover() {
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let url: string | undefined;
    // Cache-buster so every page visit gets a different cat.
    fetch(`${CAT_URL}?t=${Date.now()}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  if (failed) {
    return (
      <div className="ws-cover ws-cover-msg" role="status">
        고양이 사진을 불러오지 못했습니다.
      </div>
    );
  }
  if (!src) return <div className="ws-cover skeleton" role="status" aria-busy="true" aria-label="커버 이미지 불러오는 중…" />;
  return (
    <div className="ws-cover">
      <img src={src} alt="랜덤 고양이 커버 이미지" />
    </div>
  );
}

// 1b / 1c · 글 상세 (F-09 고유 주소, F-10 자동 저장, F-11 삭제 확인)
export default function PageDetail() {
  const { id } = useParams<{ id: string }>();
  const { pages } = useStore();
  const page = pages.find((p) => p.id === id);

  if (!page) {
    return (
      <div className="ws-blank">
        <h1>글을 찾을 수 없습니다</h1>
        <p>지워졌거나 주소가 잘못되었습니다.</p>
        <div>
          <Button variant="window" href="/pages">
            내 글로 돌아가기
          </Button>
        </div>
      </div>
    );
  }
  // Remount per page so the editor's draft state never leaks between pages.
  return <Editor key={page.id} page={page} />;
}

function Editor({ page }: { page: Page }) {
  const router = useRouter();
  const { pages } = useStore();
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const draft = useRef({ title, content });
  draft.current = { title, content };

  // Save ~1s after the user stops typing.
  const schedule = () => {
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      updatePage(page.id, draft.current);
      setDirty(false);
    }, AUTOSAVE_MS);
  };

  // Flush a pending save when leaving the page so nothing is lost (KR4).
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        updatePage(page.id, draft.current);
      }
    },
    [page.id],
  );

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirming(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  const remove = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const next = sortPages(pages).find((p) => p.id !== page.id);
    deletePage(page.id);
    router.replace(next ? `/pages/${next.id}` : "/pages");
  };

  const { total, nonSpace } = countChars(content);

  return (
    <>
      <div className="ws-top">
        <span style={{ color: "var(--fg-2)" }}>/pages/{page.id}</span>
        <span style={{ flex: 1 }} />
        {dirty ? <Tag tone="outline">저장 중…</Tag> : <Tag tone="ink">■ 저장됨</Tag>}
        {!dirty && <span style={{ color: "var(--fg-2)" }}>{savedTime(page.updatedAt)}</span>}
        <Button variant="window" size="sm" onClick={() => setConfirming(true)}>
          삭제
        </Button>
      </div>

      <div className="ws-doc">
        <CatCover />
        <div className="ws-doc-inner">
          <input
            className="ws-title"
            placeholder="제목 없음"
            value={title}
            autoFocus={!page.title && !page.content}
            onChange={(e) => {
              setTitle(e.target.value);
              schedule();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                document.querySelector<HTMLTextAreaElement>(".ws-body")?.focus();
              }
            }}
          />
          <div className="ws-rule" />
          <textarea
            className="ws-body"
            placeholder="여기에 내용을 입력하세요..."
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              schedule();
            }}
          />
          <p className="ws-count num">
            글자 수 {total.toLocaleString("ko-KR")} · 공백 제외 {nonSpace.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>

      {confirming && (
        <div className="scrim" onClick={() => setConfirming(false)}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <Window title="글 삭제" width={400} padding={24}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                  &quot;{displayTitle({ ...page, title })}&quot; 글을 지울까요?
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: "var(--fg-2)" }}>
                  지운 글은 되살릴 수 없습니다.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
                  <Button variant="window" autoFocus onClick={() => setConfirming(false)}>
                    취소
                  </Button>
                  <Button variant="solid" onClick={remove}>
                    삭제하기
                  </Button>
                </div>
              </div>
            </Window>
          </div>
        </div>
      )}
    </>
  );
}
