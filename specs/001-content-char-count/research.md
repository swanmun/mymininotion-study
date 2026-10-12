# Research: 글 내용 글자 수 표시

## R1. "한 글자"를 세는 단위

- **Decision**: `Intl.Segmenter("ko", { granularity: "grapheme" })`로 문자소(grapheme cluster) 단위로 센다.
- **Rationale**: 스펙 FR-003(사람이 보기에 한 글자 = 1자). `"한👍🏽🇰🇷é"`(é는 e + 결합 부호)를 4로 센다는 것을
  Node 24에서 직접 확인했다. 최신 브라우저와 jsdom 테스트 환경(Node 내장)에서 모두 동작한다. 의존성 추가 없음(원칙 V).
- **Alternatives considered**:
  - `text.length`: UTF-16 코드 유닛 기준이라 이모지가 2~7로 세어짐 → 탈락.
  - `[...text].length`: 코드 포인트 기준이라 피부색 이모지·국기·결합 문자가 2 이상 → 탈락.
  - 외부 라이브러리(grapheme-splitter 등): 내장 API로 충분 → YAGNI.

## R2. 공백 판정

- **Decision**: 문자소 하나가 전부 공백 문자(`/^\s+$/u`)이면 공백으로 본다. 띄어쓰기·줄바꿈(`\n`, `\r\n`)·탭·전각 공백 포함.
- **Rationale**: 스펙 Edge Cases(줄바꿈은 공백 포함 1자, 공백 제외 0자, 탭도 공백). `\r\n`은 문자소 1개이므로 1자로 세어진다.
- **Alternatives considered**: `text.replace(/\s/g, "")` 후 다시 세기 — 결과는 같지만 문자소 분할을 두 번 함 → 한 번 순회로 둘 다 계산.

## R3. 숫자 표시 형식

- **Decision**: `toLocaleString("ko-KR")`로 세 자리 쉼표, 숫자에 `.num`(tabular-nums) 적용.
- **Rationale**: FR-007, DESIGN.md 3절(숫자는 `.num`).

## R4. 계산 시점과 성능

- **Decision**: 렌더링마다 현재 입력 상태(`content`)에서 바로 계산한다. 별도 상태·메모이제이션·디바운스 없음.
- **Rationale**: FR-002(자동 저장을 기다리지 않음), SC-001. 문자소 분할은 선형 시간이라 10,000자(SC-003)도 1ms대.
  성능 문제가 측정되기 전에는 `useMemo`도 넣지 않는다(YAGNI). 저장된 값을 쓰지 않으므로 데이터 구조 변경 없음(원칙 IV).

## R5. 화면 배치와 스타일

- **Decision**: `.ws-body` 바로 아래에 `<p className="ws-count num">글자 수 N · 공백 제외 M</p>`.
  `globals.css`의 업무 페이지 구역에 `.ws-count { margin: 0; font-size: 12px; color: var(--fg-2); }` 클래스를 추가한다.
- **Rationale**: DESIGN.md 3절 "메타 12px", 2절 `--fg-2`(흰 바탕 보조 글자), 8절(가운뎃점 구분). 기존 토큰만 사용하고
  새 색·글꼴·radius 없음. 반복 인라인 스타일 대신 클래스(11절 마지막 항목).
  `.ws-doc-inner`의 요소 간격 28px을 그대로 따른다.
- **Alternatives considered**: 상단 바(`.ws-top`)에 표시 — 사용자가 "내용입력칸 아래"를 지정했으므로 탈락.

## R6. 접근성

- **Decision**: 일반 텍스트 `<p>`로 두고 `aria-live`를 쓰지 않는다.
- **Rationale**: FR-009(스크린 리더가 읽을 수 있되, 입력마다 알리지 않음). `aria-live`를 쓰면 매 키 입력마다 읽어 줘서 방해된다.

## R7. 테스트 전략 (원칙 I·II)

- **Decision**:
  1. 순수 함수 `countChars` 단위 테스트 — 손으로 센 리터럴 기대값을 담은 표(table-driven) 테스트.
  2. 글 상세 화면 통합 테스트 — 실제 `lib/store`와 jsdom `localStorage` 사용, `user-event`로 입력.
- **모킹 범위**: `next/navigation`의 `useParams`/`useRouter`만 모킹한다. jsdom에는 Next.js 라우터가 없기 때문(헌법 기술
  스택 절에서 허용한 프레임워크 경계). 모킹 객체 자체는 단언하지 않는다.
- **상태 격리**: `lib/store.ts`는 모듈 안에 상태 캐시를 두므로, 통합 테스트는 `vi.resetModules()` 후 동적 import로
  매 테스트마다 새 모듈을 받고, `signIn`/`createPage`/`updatePage` 같은 공개 API로 데이터를 준비한다. 제품 코드에
  테스트 전용 초기화 함수를 추가하지 않는다.
- **Alternatives considered**: `Editor`를 따로 export해서 테스트 — 테스트만을 위한 공개 API가 생김 → 탈락.
