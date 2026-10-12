# Implementation Plan: 글 내용 글자 수 표시

**Branch**: `001-content-char-count` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-content-char-count/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

글 상세 화면의 내용 입력칸 바로 아래에 `글자 수 N · 공백 제외 M`을 표시한다. 순수 함수 `countChars`가
`Intl.Segmenter` 문자소 단위로 공백 포함/제외 개수를 계산하고, 편집기는 입력 상태(`content`)에서 렌더링마다
바로 계산해 보여 준다. 저장 데이터와 저장 흐름은 바꾸지 않는다. 모든 코드는 TDD(원칙 I)로 작성한다.

## Technical Context

**Language/Version**: TypeScript (strict), React 19, Next.js 16 App Router

**Primary Dependencies**: 기존 의존성만 사용. 내장 `Intl.Segmenter`, `Number.prototype.toLocaleString`

**Storage**: 변경 없음 (기존 `lib/store.ts` → localStorage `mini-notion:v1`). 글자 수는 저장하지 않음

**Testing**: Vitest + React Testing Library + jsdom + jest-dom + user-event (`npm test`)

**Target Platform**: 최신 데스크톱·모바일 브라우저 (`Intl.Segmenter` 지원)

**Project Type**: 웹 애플리케이션 (Next.js 단일 프로젝트, 프런트엔드 전용)

**Performance Goals**: 키 입력 즉시 갱신. 10,000자 내용에서도 입력이 끊기지 않음 (SC-001, SC-003)

**Constraints**: DESIGN.md 규칙 (기존 토큰만, 12px 메타, `.num`), 새 의존성 없음, 월 0원

**Scale/Scope**: 파일 2개 추가(`lib/charCount.ts` + 테스트), 파일 2개 수정(`app/pages/[id]/page.tsx`, `app/globals.css`),
통합 테스트 1개 추가

모든 항목이 정해져 NEEDS CLARIFICATION 없음 (세부 결정은 [research.md](research.md)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 내용 | 설계 전 | 설계 후 |
|---|---|---|---|
| I. TDD (타협 불가) | 모든 작업을 `superpowers:test-driven-development`로 RED → GREEN → REFACTOR. 테스트 작업이 구현 작업보다 앞선다 | PASS | PASS — R7에 테스트 우선 순서 명시 |
| II. 실제 동작 테스트 | 리터럴 기대값 표 테스트, 실제 store·localStorage 사용, 모킹은 `next/navigation`만, 모킹 단언 없음, 테스트 전용 코드는 제품 코드에 넣지 않음 | PASS | PASS — 계약 1절 리터럴 표, `vi.resetModules`로 격리 (제품 코드에 reset 함수 추가 안 함) |
| III. 디자인 시스템 | 작업형 화면, 기존 토큰 `--fg-2`, 12px 메타, `.num`, 가운뎃점 구분, 새 hex·radius·그림자 없음, 인라인 대신 `.ws-count` 클래스 | PASS | PASS — 새 클래스는 기존 토큰 조합이라 새 토큰·DS 컴포넌트 추가 없음 (12절 1단계로 해결) |
| IV. 데이터 계층 | 화면이 localStorage에 직접 접근하지 않음, 저장 계약 변경 없음, KR4 영향 없음 | PASS | PASS — `countChars`는 데이터 계층이 아닌 순수 유틸 |
| V. 작게·무료 | 새 의존성 없음, MVP 편집 화면 안의 작은 개선, 메모이제이션 등 미리 만들지 않음 | PASS | PASS |

위반 없음 → Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/001-content-char-count/
├── plan.md              # 이 파일
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── char-count.md    # Phase 1 — 함수 계약 + UI 계약
├── checklists/
│   └── requirements.md  # /speckit-specify 산출물
└── tasks.md             # Phase 2 (/speckit-tasks, 아직 없음)
```

### Source Code (repository root)

```text
lib/
├── store.ts               # 변경 없음
├── charCount.ts           # 신규 — countChars(text)
└── charCount.test.ts      # 신규 — 계약 표 기반 단위 테스트

app/
├── globals.css            # 수정 — 업무 페이지 구역에 .ws-count 추가
└── pages/[id]/
    ├── page.tsx           # 수정 — textarea 아래 글자 수 표시
    └── page.test.tsx      # 신규 — 글 상세 화면 통합 테스트

vitest.config.mts, vitest.setup.ts   # 기존 테스트 설정, 변경 없음
```

**Structure Decision**: 기존 Next.js 단일 프로젝트 구조를 그대로 쓴다. 순수 계산은 `lib/`에, 테스트는 대상 파일 옆
`*.test.ts(x)`에 둔다 (헌법 기술 스택 절).

## Complexity Tracking

해당 없음 — Constitution Check 위반 없음.
