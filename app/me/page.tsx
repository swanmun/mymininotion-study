"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import RequireAuth from "@/components/RequireAuth";
import { Button, Input, Textarea, Window } from "@/components/ds";
import { fullDate, saveAvatar, saveIntro, saveNickname, signOut, useStore } from "@/lib/store";

const MAX_NICK = 20;
const MAX_INTRO = 200;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// 1d · 마이 페이지 (F-04 로그아웃, F-05 별명, F-06 프로필 이미지, 자기소개)
export default function MyPage() {
  return (
    <RequireAuth>
      <MyPageInner />
    </RequireAuth>
  );
}

function MyPageInner() {
  const { user, pages } = useStore();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(user!.nickname);
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nickError, setNickError] = useState("");
  const [intro, setIntro] = useState(user!.intro);
  const [introSaving, setIntroSaving] = useState(false);
  const [introSaved, setIntroSaved] = useState(false);
  const [introError, setIntroError] = useState("");

  const trimmed = nickname.trim();
  const nickValid = trimmed.length >= 1 && trimmed.length <= MAX_NICK;
  const nickChanged = trimmed !== user!.nickname;

  const onSaveNickname = async () => {
    if (!nickValid || !nickChanged || saving) return;
    setSaving(true);
    setNickError("");
    const { error } = await saveNickname(trimmed);
    setSaving(false);
    if (error) return setNickError("별명을 저장하지 못했습니다.");
    setNickname(trimmed);
    setSaved(true);
  };

  const introTrimmed = intro.trim();
  const introChanged = introTrimmed !== user!.intro;

  const onSaveIntro = async () => {
    if (!introChanged || introSaving) return;
    setIntroSaving(true);
    setIntroError("");
    const { error } = await saveIntro(introTrimmed);
    setIntroSaving(false);
    if (error) return setIntroError("자기소개를 저장하지 못했습니다.");
    setIntro(introTrimmed);
    setIntroSaved(true);
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setImageError("JPG · PNG · WEBP 파일만 올릴 수 있습니다.");
    if (file.size > MAX_IMAGE_BYTES) return setImageError("2MB 이하 이미지만 올릴 수 있습니다.");
    setImageError("");
    setUploading(true);
    const { error } = await saveAvatar(file);
    setUploading(false);
    if (error) setImageError("이미지를 올리지 못했습니다.");
  };

  return (
    <div className="me">
      <header className="me-bar">
        <Button variant="chip" href="/pages">
          ← 업무 페이지
        </Button>
        <Button
          variant="chip"
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
        >
          로그아웃
        </Button>
      </header>

      <main className="me-main">
        <div className="me-copy">
          <div className="leader">
            <span>계정</span>
            <span className="leader-line" />
            <span>{user!.email}</span>
          </div>
          <h1 className="me-h1">
            마이
            <br />
            페이지
          </h1>
          {user!.intro && <p className="me-lead">{user!.intro}</p>}
          <div className="me-stats">
            <div className="me-stat">
              <b>가입일</b>
              <span>{fullDate(user!.createdAt)}</span>
            </div>
            <div className="me-stat">
              <b>내 글</b>
              <span>{pages.length}개</span>
            </div>
          </div>
        </div>

        <Window title="프로필.app" padding={28}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
              <div style={{ position: "relative" }}>
                <Avatar src={user!.avatarUrl} size={120} />
                {!user!.avatarUrl && (
                  <span
                    style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 600,
                    }}
                  >
                    <span style={{ background: "var(--white)", padding: "2px 4px" }}>프로필 이미지</span>
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button variant="window" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  이미지 변경
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  hidden
                  onChange={(e) => {
                    void onPickImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                {imageError ? (
                  <span className="me-err" role="alert">
                    {imageError}
                  </span>
                ) : (
                  <span className="hint">{uploading ? "이미지를 올리는 중…" : "JPG · PNG · WEBP, 최대 2MB"}</span>
                )}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--ink-900)" }} />

            <form
              style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
              onSubmit={(e) => {
                e.preventDefault();
                void onSaveNickname();
              }}
            >
              <Input
                label="별명"
                value={nickname}
                maxLength={MAX_NICK}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setSaved(false);
                  setNickError("");
                }}
              />
              <Button type="submit" variant="solid" style={{ height: 30 }} disabled={!nickValid || !nickChanged || saving}>
                저장
              </Button>
            </form>
            <div className="hint num" style={{ display: "flex", justifyContent: "space-between", marginTop: -16 }}>
              {trimmed.length === 0 ? (
                <span className="me-err">빈 값은 저장할 수 없습니다.</span>
              ) : nickError ? (
                <span className="me-err" role="alert">
                  {nickError}
                </span>
              ) : saving ? (
                <span>저장 중…</span>
              ) : saved ? (
                <span>저장되었습니다.</span>
              ) : (
                <span>1~20자, 빈 값은 저장할 수 없습니다.</span>
              )}
              <span>
                {nickname.length} / {MAX_NICK}
              </span>
            </div>

            <form
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                void onSaveIntro();
              }}
            >
              <Textarea
                label="자기소개"
                value={intro}
                rows={4}
                maxLength={MAX_INTRO}
                placeholder="나를 한두 문장으로 소개합니다."
                aria-keyshortcuts="Control+Enter Meta+Enter"
                onChange={(e) => {
                  setIntro(e.target.value);
                  setIntroSaved(false);
                  setIntroError("");
                }}
                onKeyDown={(e) => {
                  // Enter adds a line; Ctrl/Cmd+Enter saves.
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void onSaveIntro();
                  }
                }}
              />
              <div className="hint num" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {introError ? (
                  <span className="me-err" role="alert">
                    {introError}
                  </span>
                ) : introSaving ? (
                  <span>저장 중…</span>
                ) : introSaved ? (
                  <span>저장되었습니다.</span>
                ) : (
                  <span>최대 200자 · Ctrl+Enter로 저장합니다.</span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span>
                    {intro.length} / {MAX_INTRO}
                  </span>
                  <Button type="submit" variant="window" size="sm" disabled={!introChanged || introSaving}>
                    저장
                  </Button>
                </span>
              </div>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>이메일</span>
              <span style={{ fontSize: 15, color: "var(--fg-2)" }}>{user!.email} · 구글 계정</span>
            </div>
          </div>
        </Window>
      </main>
    </div>
  );
}
