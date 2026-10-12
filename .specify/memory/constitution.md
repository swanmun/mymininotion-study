<!--
Sync Impact Report
- Version change: (template, unversioned) → 1.0.0
- Modified principles: 템플릿 자리표시자 5개 → 아래 5개 원칙으로 최초 정의
  - [PRINCIPLE_1_NAME] → I. 테스트 우선 개발 (TDD, 타협 불가)
  - [PRINCIPLE_2_NAME] → II. 실제 동작을 검증하는 테스트
  - [PRINCIPLE_3_NAME] → III. 디자인 시스템 준수
  - [PRINCIPLE_4_NAME] → IV. 데이터 계층 경계와 무손실 저장
  - [PRINCIPLE_5_NAME] → V. 작게, 무료로, 혼자 쓰는 범위
- Added sections: 기술 스택과 테스트 환경, 개발 흐름과 품질 관문, Governance
- Removed sections: 없음
- Templates: 이 명령은 템플릿을 수정하지 않음 (런타임에 헌법을 읽음)
- Deferred TODOs: 없음
-->

# 미니 노션 Constitution

## Core Principles

### I. 테스트 우선 개발 (TDD, 타협 불가)

모든 기능 추가·버그 수정·리팩터링·동작 변경은 superpowers의 `/test-driven-development`
스킬(`superpowers:test-driven-development`)을 **반드시 호출한 뒤** 그 절차대로 진행한다.

- 철칙: **실패하는 테스트 없이 제품 코드를 쓰지 않는다.**
- 순서는 RED(실패하는 테스트 1개 작성) → RED 확인(`npm test`로 기대한 이유로 실패하는지 직접 본다)
  → GREEN(통과에 필요한 최소 코드) → GREEN 확인(전체 스위트 통과, 경고 없는 출력)
  → REFACTOR(초록 상태 유지) 를 반복한다.
- 테스트보다 먼저 쓴 제품 코드는 지우고 테스트부터 다시 시작한다. "참고용으로 남기기"는 허용하지 않는다.
- 버그는 먼저 그 버그를 재현하는 실패 테스트를 쓴 뒤 고친다.
- 예외(일회용 프로토타입, 생성된 코드, 설정 파일)는 사용자(제품 책임자)의 명시적 허락이 있을 때만 둔다.
- 완료 선언 전에 스킬의 검증 체크리스트를 모두 충족해야 하며, 하나라도 못 채우면 TDD를 건너뛴 것으로 본다.

근거: 실패하는 것을 보지 못한 테스트는 올바른 것을 검사하는지 알 수 없다. 1인 개발 프로젝트에서
회귀를 막는 유일한 안전망이 자동 테스트다.

### II. 실제 동작을 검증하는 테스트

테스트 작성·수정 시 `/test-driven-development`의 `writing-good-tests.md` 규칙을 그대로 따른다.

- 테스트 본문을 쓰기 전에 **이 테스트를 실패시킬 제품 코드 변경**을 말할 수 있어야 한다.
- 기대값은 리터럴이나 손으로 확인한 고정 데이터로 쓴다. 테스트 대상 코드로 기대값을 계산하지 않는다.
- 모킹은 **피할 수 없을 때만**, 느리거나 외부에 있는 층에만 한다. 모킹 전에 실제 메서드의 부수 효과를 파악하고,
  테스트가 의존하는 부분은 실제로 남긴다.
- 모킹 객체 자체를 단언하지 않는다 (`*-mock` test id 확인 금지). 모킹 응답은 실제 데이터 구조 전체를 따른다.
- `localStorage`는 jsdom의 실제 구현을 쓰고 모킹하지 않는다. 테스트 사이 정리는 `vitest.setup.ts`에서 한다.
- 테스트에서만 쓰는 정리·도우미 코드는 테스트 유틸에 두고, 제품 코드(`lib/`, `components/`, `app/`)에 넣지 않는다.
- 상수 값·문구 텍스트만 확인하는 "변경 감지 테스트"를 쓰지 않는다. 그 값에 의존하는 동작을 검증한다.
- 테스트 파일을 마치기 전에 변이 점검(잘못된 상수, 잘못된 분기, 빠진 상태 변화, 빈 반환, 빠진 검증)을 하고,
  각 변이를 잡는 테스트가 하나 이상 있는지 확인한다.

근거: 모킹을 검증하는 테스트는 통과해도 아무것도 보장하지 않는다.

### III. 디자인 시스템 준수

화면·스타일·문구 작업은 `DESIGN.md`(Halftone Design System)와 `CLAUDE.md`의 디자인 작업 규칙을 따른다.

- 작업 전에 `DESIGN.md`를 읽고, 화면 패턴(포스터형 / 작업형)을 먼저 정한다.
- `app/globals.css` 토큰과 `@/components/ds` 컴포넌트를 먼저 재사용한다.
- 금지: 팔레트에 없는 hex 값, 새 글꼴, `border-radius`, 흐린 그림자, 그라데이션(도트 무늬 제외), 이모지,
  860px / 960px 외의 반응형 기준값.
- 문구는 "~합니다" 존댓말 평서문, 제한 조건은 숫자로 쓴다.
- 작업 후 `DESIGN.md` 11절 체크리스트로 점검하고 어긋난 항목을 보고한다.

근거: 한 사람이 만들어도 화면 전체가 하나의 시스템으로 보여야 한다.

### IV. 데이터 계층 경계와 무손실 저장

- 화면 코드는 `lib/store.ts`가 내보내는 API로만 데이터를 읽고 쓴다. `localStorage`에 직접 접근하지 않는다.
- 저장 방식이 바뀌어도(예: Supabase/Firebase로 교체) 내보내는 API의 계약은 유지한다. 계약 변경은 테스트로 먼저 표현한다.
- 저장 후 새로고침해도 데이터가 사라지지 않아야 한다 (PRD KR4: 유실 0건). 저장·불러오기·삭제 동작은 테스트로 보장한다.

근거: 데이터 계층을 한곳에 모아야 백엔드를 바꿔도 화면과 테스트가 그대로 동작한다.

### V. 작게, 무료로, 혼자 쓰는 범위

- MVP 범위(로그인, 마이 페이지, 글 생성·수정·삭제)를 벗어나는 기능은 PRD를 고친 뒤에만 추가한다.
- 공유·협업 등 다중 사용자 기능은 만들지 않는다.
- 운영 비용은 월 0원을 유지한다 (PRD KR3). 유료 요금제가 필요한 의존성을 추가하지 않는다.
- 지금 필요하지 않은 옵션·추상화를 미리 만들지 않는다 (YAGNI).

근거: 개발자가 1명이므로 범위를 작게 유지해야 끝까지 만들고 계속 쓸 수 있다.

## 기술 스택과 테스트 환경

- 앱: Next.js 16 (App Router) · React 19 · TypeScript (strict) · 경로 별칭 `@/*`.
- 테스트: **Vitest** + **React Testing Library** + **jsdom** + `@testing-library/jest-dom` + `@testing-library/user-event`.
  - 설정: `vitest.config.mts` (jsdom 환경, `resolve.tsconfigPaths`, `restoreMocks: true`), `vitest.setup.ts`
    (jest-dom 매처, 테스트마다 `cleanup()`과 `localStorage.clear()`).
  - 테스트 파일: 대상 파일 옆에 `*.test.ts` / `*.test.tsx`로 둔다.
  - 실행: `npm test`(전체 1회), `npm run test:watch`(감시 모드).
- UI 테스트는 역할·라벨·보이는 텍스트(`getByRole`, `getByLabelText`)로 요소를 찾고, `user-event`로 실제 사용자처럼 조작한다.
- `next/navigation`처럼 jsdom에서 동작하지 않는 프레임워크 경계만 모킹 대상이 될 수 있으며, 이때도 원칙 II를 따른다.

## 개발 흐름과 품질 관문

1. 기능은 Spec Kit 흐름(`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`)으로 진행한다.
2. `/speckit-tasks`가 만드는 작업 목록에서 **테스트 작업은 해당 구현 작업보다 앞에 온다.**
3. `/speckit-implement` 중 각 작업은 `/test-driven-development`의 RED → GREEN → REFACTOR 주기로 수행한다.
4. 완료 선언 전 관문:
   - `npm test` 전체 통과, 출력에 에러·경고 없음. 내가 만들지 않은 실패도 이름을 들어 보고한다.
   - 각 테스트가 먼저 실패하는 것을 확인했다.
   - 디자인 작업이면 `DESIGN.md` 11절 체크리스트를 점검했다.
5. 관문을 통과하지 못하면 작업을 완료로 표시하지 않는다.

## Governance

- 이 헌법은 이 프로젝트의 다른 모든 작업 관행보다 우선한다. `CLAUDE.md`·`DESIGN.md`와 충돌하면 헌법을 고치거나
  해당 문서를 고쳐 일치시키고, 그 결정을 기록한다.
- 개정 절차: 변경 내용과 이유를 적고 제품 책임자가 승인한 뒤 `/speckit-constitution`으로 반영한다.
- 버전 규칙 (Semantic Versioning):
  - MAJOR: 원칙 삭제 또는 호환되지 않는 재정의.
  - MINOR: 원칙·절 추가 또는 지침의 실질적 확장.
  - PATCH: 문구 명확화, 오탈자 수정.
- 준수 점검: 모든 계획(`plan.md`)은 "Constitution Check"에서 다섯 원칙을 확인하고, 위반은 정당화와 함께 기록한다.
  원칙 I의 예외는 사용자의 명시적 허락 없이는 정당화될 수 없다.
- 일상 개발 지침은 `CLAUDE.md`와 `DESIGN.md`를 따른다.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
