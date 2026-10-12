---

description: "Task list for 글 내용 글자 수 표시"
---

# Tasks: 글 내용 글자 수 표시

**Input**: Design documents from `/specs/001-content-char-count/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/char-count.md, quickstart.md

**Tests**: 헌법 원칙 I(TDD, 타협 불가)에 따라 모든 동작에 테스트 작업이 있고, 테스트 작업이 해당 구현 작업보다 앞선다.
모든 테스트·구현 작업은 `superpowers:test-driven-development` 스킬을 호출한 뒤 수행한다.

- **RED 작업**: 테스트를 쓰고 `npm test -- <파일>`로 **기대한 이유로 실패**하는지 직접 확인한다
  (오타·import 오류·하네스 오류로 실패하면 RED가 아니다 — 고쳐서 다시 실행).
- **GREEN 작업**: 통과에 필요한 최소 코드만 쓴다. 그 뒤 `npm test`(전체)로 모두 통과·경고 없음을 확인한다.
- 테스트 규칙(원칙 II): 기대값은 손으로 센 리터럴, 실제 store·jsdom localStorage 사용, 모킹은 `next/navigation`만,
  모킹 객체 자체를 단언하지 않음, 테스트 전용 코드는 제품 코드에 넣지 않음.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Next.js 단일 프로젝트, 저장소 루트 기준: `lib/`, `app/`. 테스트는 대상 파일 옆 `*.test.ts(x)`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 테스트 환경이 초록 상태인지 확인

- [X] T001 `npm test`를 실행해 기존 설정(`vitest.config.mts`, `vitest.setup.ts`)으로 exit 0, 에러·경고 없음을 확인한다 (설정 파일은 수정하지 않음)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 글 상세 화면 통합 테스트를 위한 하네스. US1·US2의 UI 테스트가 모두 이것을 쓴다.

- [X] T002 `app/pages/[id]/page.test.tsx`를 만들고 테스트 하네스만 작성한다 (이 작업에서는 단언 테스트를 쓰지 않음):
  - `vi.mock("next/navigation", ...)`: `useParams`는 테스트가 정한 현재 글 id(`{ id }`)를 돌려주고, `useRouter`는
    `{ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }`를 돌려준다
    (실제 `AppRouterInstance`의 메서드 구조를 모두 갖춤 — 원칙 II "실제 구조 전체").
  - `next/link`는 jsdom에서 렌더링되므로 모킹하지 않는다.
  - 헬퍼 `renderPage(content: string)`: `vi.resetModules()` → `await import("@/lib/store")` → `createPage()` →
    `updatePage(page.id, { content })` → 현재 id를 `page.id`로 설정 → `await import("./page")`의 기본 export를 `render`.
    제품 코드(`lib/store.ts`)에 테스트용 초기화 함수를 추가하지 않는다 (research R7).
  - 이 헬퍼는 테스트 파일 안에만 둔다.

**Checkpoint**: 하네스 준비 완료 — US1의 첫 RED 테스트가 "글자 수 텍스트 없음"으로 실패하면 하네스가 동작하는 것이다.

---

## Phase 3: User Story 1 - 입력하는 동안 글자 수 확인 (Priority: P1) — MVP

**Goal**: 내용 입력칸 바로 아래에 공백 포함 글자 수(`글자 수 N`)가 보이고, 입력·삭제 즉시 바뀐다.

**Independent Test**: 글 상세 화면에서 입력·삭제하면서 입력칸 아래 숫자가 바뀌는지 확인 (spec US1 시나리오 1~5).

### Tests & Implementation for User Story 1 (RED → GREEN 순서 엄수)

- [X] T003 [P] [US1] RED: `lib/charCount.test.ts`에 `countChars(text).total` 표 테스트를 쓴다. 기대값은
  `contracts/char-count.md` 1절 표의 total 열 리터럴 그대로: `""`→0, `"안녕 하세요"`→6, `"가 나\n다"`→5, `"   "`→3,
  `"a\tb"`→3, `"a\r\nb"`→3, `"👍🏽🇰🇷"`→2, `"é"`→1, `"한글"`→2. `npm test -- lib/charCount.test.ts`로
  "모듈/함수 없음"으로 실패하는지 확인한다.
- [X] T004 [US1] GREEN: `lib/charCount.ts`에 `export function countChars(text: string): { total: number; nonSpace: number }`를
  만들고 `Intl.Segmenter("ko", { granularity: "grapheme" })`로 문자소 수를 `total`로 돌려준다 (research R1).
  이 단계에서 `nonSpace`는 T003을 통과시키는 데 필요하지 않으므로 아직 계산하지 않고 US2(T010)에서 TDD로 채운다 —
  타입을 맞추기 위한 임시 값은 `total`과 같게 둔다. 부수 효과 없음. T003 통과 후 `npm test` 전체 통과 확인.
- [X] T005 [US1] RED: `app/pages/[id]/page.test.tsx`에 화면 테스트를 추가한다 (T002 하네스 사용, 요소는
  `getByPlaceholderText("여기에 내용을 입력하세요...")`·`getByText`로 찾고 입력은 `userEvent`로):
  1. `renderPage("")` → `글자 수 0` 텍스트가 보인다.
  2. `renderPage("회의 메모")` → 입력 없이 `글자 수 5`가 보인다 (FR-005).
  3. `renderPage("")` 후 `"안녕 하세요"` 입력 → `글자 수 6`; `{Backspace}` 1회 → `글자 수 5` (FR-002, 저장 1초를 기다리지 않음).
  4. 글자 수 요소가 내용 입력칸의 바로 다음 형제 요소이다 (`textarea.nextElementSibling`, FR-001).
  `npm test -- "app/pages/[id]/page.test.tsx"`로 "글자 수 텍스트를 찾을 수 없음"으로 실패하는지 확인한다.
- [X] T006 [US1] GREEN: `app/pages/[id]/page.tsx`의 `Editor`에서 `<textarea className="ws-body">` 바로 다음에
  `<p className="ws-count num">글자 수 {total.toLocaleString("ko-KR")}</p>`를 넣는다. `total`은 렌더링마다
  `countChars(content)`로 계산한다 (상태·`useMemo`·디바운스 추가 금지, research R4). `aria-live`를 붙이지 않는다 (FR-009).
  T005 통과 후 `npm test` 전체 통과 확인.
- [X] T007 [US1] RED → GREEN: `app/pages/[id]/page.test.tsx`에 1,000 이상 쉼표 테스트를 추가한다 —
  `renderPage("가".repeat(1234))` → `글자 수 1,234` (FR-007). T006 구현으로 이미 통과하면 RED가 아니므로,
  먼저 T006의 `toLocaleString` 호출을 잠시 빼서 실패를 확인한 뒤 되돌린다 (변이 점검으로 테스트가 쉼표를 지키는지 증명).
- [X] T008 [P] [US1] `app/globals.css`의 업무 페이지 구역(`.ws-body` 규칙 다음)에
  `.ws-count { margin: 0; font-size: 12px; color: var(--fg-2); }`를 추가한다. 기존 토큰만 사용, 새 hex·radius·그림자 없음
  (DESIGN.md 2·3·5절). 시각 스타일은 jsdom에서 의미 있게 검증할 수 없어 자동 테스트를 쓰지 않는다 —
  헌법 원칙 I에 따라 이 예외는 **사용자 허락이 필요**하며(구현 전에 확인), 대신 T015 수동 점검으로 확인한다.

**Checkpoint**: US1 완료 — `글자 수 N`이 입력칸 아래에 실시간으로 보인다. 이 상태로 배포 가능한 MVP.

---

## Phase 4: User Story 2 - 공백을 뺀 글자 수 확인 (Priority: P2)

**Goal**: 같은 줄에 `· 공백 제외 M`을 함께 표시한다 (띄어쓰기·줄바꿈·탭 제외).

**Independent Test**: 공백·줄바꿈이 섞인 내용을 입력해 공백 제외 숫자가 맞는지 확인 (spec US2 시나리오 1~3).

### Tests & Implementation for User Story 2 (RED → GREEN 순서 엄수)

- [X] T009 [US2] RED: `lib/charCount.test.ts`의 표에 `nonSpace` 기대값을 추가한다 (`contracts/char-count.md` 1절 리터럴):
  `""`→0, `"안녕 하세요"`→5, `"가 나\n다"`→3, `"   "`→0, `"a\tb"`→2, `"a\r\nb"`→2, `"👍🏽🇰🇷"`→2, `"é"`→1, `"한글"`→2.
  T004의 임시 값(`nonSpace = total`) 때문에 공백이 있는 행이 실패하는지 확인한다.
- [X] T010 [US2] GREEN: `lib/charCount.ts`에서 문자소가 `/^\s+$/u`에 맞으면 `nonSpace`에서 제외하도록 한 번 순회로
  `total`과 `nonSpace`를 함께 계산한다 (research R2). 불변 조건 "`0 ≤ nonSpace ≤ total`. 빈 문자열이면 `{ total: 0, nonSpace: 0 }`"
  (data-model.md). T009 통과 후 `npm test` 전체 통과 확인.
- [X] T011 [US2] RED: `app/pages/[id]/page.test.tsx`에 화면 테스트를 추가한다:
  1. `renderPage("")` 후 `"안녕 하세요"` 입력 → `글자 수 6 · 공백 제외 5`.
  2. `renderPage("")` 후 `"가 나{Enter}다"` 입력 → `글자 수 5 · 공백 제외 3`.
  3. `renderPage("   ")` → `글자 수 3 · 공백 제외 0`.
  4. `renderPage("가".repeat(1000) + " ")` → `글자 수 1,001 · 공백 제외 1,000`.
  T005·T007의 기대 문구도 계약 2절 전체 문구(`글자 수 N · 공백 제외 M`)로 바꾼다. 실행해 "공백 제외 문구 없음"으로 실패하는지 확인한다.
- [X] T012 [US2] GREEN: `app/pages/[id]/page.tsx`의 글자 수 문구를
  `글자 수 {total.toLocaleString("ko-KR")} · 공백 제외 {nonSpace.toLocaleString("ko-KR")}`로 바꾼다
  (가운뎃점 앞뒤 공백 1칸, DESIGN.md 8절 5항). T011 통과 후 `npm test` 전체 통과 확인.

**Checkpoint**: US1·US2 모두 동작 — 계약 2절 문구가 그대로 보인다.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] `app/pages/[id]/page.test.tsx`에 "글을 찾을 수 없습니다" 화면(없는 id)에서 `글자 수` 텍스트가 없는지 테스트를 추가하고,
  `Editor` 밖에 글자 수를 두는 변이로 실패하는지 확인한다 (spec Edge Cases). 그리고 기존 동작 회귀 확인(FR-010, SC-005):
  `npm test` 전체 통과.
- [X] T014 변이 점검(`writing-good-tests.md`): `lib/charCount.ts`와 `page.tsx`에서 (a) `Intl.Segmenter` 대신 `text.length`,
  (b) 공백 판정 정규식에서 `u` 플래그·`+` 제거, (c) `toLocaleString` 제거, (d) `content` 대신 `page.content` 사용(입력 즉시 갱신 깨짐)
  을 하나씩 적용해 각각 하나 이상의 테스트가 실패하는지 확인하고 되돌린다. 잡히지 않는 변이가 있으면 테스트를 추가한다 (RED → GREEN).
- [X] T015 DESIGN.md 11절 체크리스트로 `app/pages/[id]/page.tsx`·`app/globals.css` 변경을 점검하고 `quickstart.md` 수동 시나리오 1~7을
  `npm run dev`로 확인한다 (12px·`--fg-2`·`.num`, 860px 이하 레이아웃, 숫자 폭 흔들림 없음). 어긋난 항목은 사용자에게 보고한다.
- [X] T016 최종 관문(헌법 "개발 흐름과 품질 관문" 4항): `npm test` 전체 통과·출력 깨끗함, 각 테스트가 먼저 실패하는 것을 봤는지,
  TDD 스킬 검증 체크리스트 충족 여부를 정리해 보고한다. `npx tsc --noEmit`으로 타입 에러 없음도 확인한다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002)** → **US1 (T003~T008)** → **US2 (T009~T012)** → **Polish (T013~T016)**
- US2는 US1의 `countChars`와 화면 문구 위에 쌓이므로 US1 다음에 한다 (같은 파일을 고침).

### Within Each User Story

- 항상 RED 작업 → GREEN 작업. RED에서 실패를 직접 확인하기 전에는 GREEN으로 넘어가지 않는다.
- T003(단위 테스트 RED)은 T002와 다른 파일이라 T002와 동시에 할 수 있다.
- T005는 T002(하네스)와 T004(`countChars`)가 끝나야 의미 있는 RED가 된다.
- T008(CSS)은 다른 파일이라 T005~T007과 동시에 할 수 있다.

### Parallel Opportunities

```text
# Foundational과 US1 단위 테스트를 동시에:
T002 app/pages/[id]/page.test.tsx (하네스)
T003 lib/charCount.test.ts (RED)

# US1 화면 작업 중 스타일을 동시에:
T005~T007 app/pages/[id]/page.tsx / page.test.tsx
T008 app/globals.css

# Polish:
T013 page.test.tsx  |  T015 수동 점검은 T013·T014 후
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 → T002 → T003~T008
2. **STOP and VALIDATE**: `npm test` 통과, 브라우저에서 `글자 수 N` 확인
3. 여기까지로도 요청("내용 입력칸 아래 글자 수")은 충족

### Incremental Delivery

1. US1(MVP) → 확인
2. US2(공백 제외) 추가 → 확인
3. Polish(회귀·변이 점검·디자인 점검·최종 관문)

---

## Notes

- 모든 작업 시작 시 `superpowers:test-driven-development`를 호출한다 (헌법 원칙 I).
- 테스트보다 먼저 제품 코드를 쓴 경우, 그 코드를 지우고 테스트부터 다시 한다.
- 이 폴더는 git 저장소가 아니므로 커밋 작업은 넣지 않았다.
