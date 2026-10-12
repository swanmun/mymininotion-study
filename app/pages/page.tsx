"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sortPages, useStore } from "@/lib/store";

// /pages — open the most recently edited page, or show the empty state.
export default function PagesIndex() {
  const { pages } = useStore();
  const router = useRouter();
  const latest = sortPages(pages)[0];

  useEffect(() => {
    if (latest) router.replace(`/pages/${latest.id}`);
  }, [latest, router]);

  if (latest) return null;

  return (
    <>
      <div className="ws-top">
        <span style={{ color: "var(--fg-2)" }}>/pages</span>
      </div>
      <div className="ws-blank">
        <h1>글이 없습니다</h1>
        <p>
          왼쪽 아래 입력창에 <kbd>/page</kbd>를 입력하고 Enter를 누르면 새 글이 만들어집니다.
        </p>
      </div>
    </>
  );
}
