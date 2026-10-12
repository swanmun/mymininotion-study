"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Tag, Window } from "@/components/ds";
import { signIn, useStore } from "@/lib/store";

// 1a · 로그인 페이지 (F-01 구글 로그인, F-02 로그인 유지)
export default function LoginPage() {
  const { ready, user } = useStore();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && user) router.replace("/pages");
  }, [ready, user, router]);

  // Google/Supabase send failures back as ?error=…&error_description=….
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setError("구글 로그인을 완료하지 못했습니다.");
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  const startGoogleLogin = async () => {
    setPending(true);
    setError("");
    const { error } = await signIn();
    // On success the browser is already leaving for Google.
    if (error) {
      setError("구글 로그인을 시작하지 못했습니다.");
      setPending(false);
    }
  };

  return (
    <div className="login">
      <div className="login-dots" />
      <div className="login-b64">[B.64] bWluaS1ub3Rpb24vdjAuMDEvcGFnZXM=</div>

      <header className="login-bar">
        <span className="login-brand">미니 노션</span>
        <Tag tone="paper">Version 0.01</Tag>
      </header>

      <main className="login-main">
        <div className="login-copy">
          <div className="leader">
            <span>개인 업무 관리</span>
            <span className="leader-line" />
            <span>MVP</span>
          </div>
          <h1 className="login-h1">
            미니
            <br />
            노션
          </h1>
          <p className="login-lede">내 업무를 한 곳에서, 무료로, 내 방식대로 관리합니다.</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Window title="로그인.app" width={380} padding={28}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1 }}>시작하기</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4, color: "var(--fg-2)" }}>
                처음 로그인하면 계정이 자동으로 만들어집니다.
              </p>
              <Button
                variant="window"
                size="lg"
                style={{ width: "100%", justifyContent: "center", height: 44 }}
                disabled={pending || !ready}
                onClick={startGoogleLogin}
              >
                <span className="g-mark">G</span>
                {pending ? "구글로 이동 중…" : "구글 계정으로 로그인"}
              </Button>
              {error ? (
                <div className="me-err" role="alert">
                  {error}
                </div>
              ) : (
                <div className="hint num">로그인 상태는 브라우저를 닫아도 유지됩니다.</div>
              )}
            </div>
          </Window>
        </div>
      </main>

      <footer className="login-foot">
        <span>∵ 비용 월 0원</span>
        <span>데이터는 내 것 ×</span>
      </footer>
    </div>
  );
}
