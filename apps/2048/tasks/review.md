# Review 지침: 2048 게임

## 역할
너는 Review 서브에이전트다. Build 단계와 분리된 검증자로서, `apps/2048/`의 구현이 승인된 명세 `apps/2048/spec.md`를 충족하는지 확인하고 결과를 `apps/2048/review.md`에 기록한다. 문제가 있으면 수정한다.

## 수정 허용 범위
- 새로 만들기: `apps/2048/review.md`
- 문제 수정 시에만 편집: `apps/2048/index.html`, `apps/2048/style.css`, `apps/2048/js/*.js`
- **수정 금지:** `apps/2048/spec.md`, `apps/2048/tasks/`, `apps/2048/` 밖의 모든 파일. git 커밋하지 않는다.
- 테스트용 임시 스크립트는 저장소에 남기지 않는다(OS 임시 폴더 사용).

## 검증 방법
1. **브라우저 검증** — 내장 브라우저 도구(`mcp__Claude_Browser__*`)로 확인한다. `preview_start`에 `{name: "blog"}`를 주면 `.claude/launch.json`의 개발 서버(`node serve.js 8000`)가 뜬다. `http://localhost:8000/apps/2048/` 로 이동한다. Bash로 서버를 띄우지 않는다.
   - 콘솔 오류, 404 등 네트워크 오류 없음
   - 방향키·WASD 이동, 병합, 점수 증가, 최고 점수 저장(새로고침 후 유지), 새 게임 버튼
   - 승리/게임 오버 오버레이: 필요하면 `javascript_tool`로 상태를 조작해 확인(디버깅 용도로만)
   - 라이트/다크 테마 모두 확인 (`resize_window`의 `colorScheme`, 또는 `localStorage.theme` 설정 후 새로고침)
   - 모바일 폭 375px에서 가로 스크롤 없음(`document.documentElement.scrollWidth <= innerWidth`), 버튼 44px 이상
   - 스와이프는 실제 터치 재현이 어려우면 코드 리뷰로 확인하고 그렇게 적는다
   - 검증이 끝나면 `resize_window` preset `desktop`으로 되돌린다
2. **코드 리뷰** — spec.md 7장 완료 기준을 항목별로 대조하고, 버그·보안(innerHTML 사용 시 이스케이프)·접근성·전역 변수·하드코딩 색상 여부를 본다.
3. **로직 검증** — `game.js`를 Node로 불러 병합 규칙(한 번 이동에 타일당 1회 병합, 무효 이동 시 타일 미생성 등)을 확인한다.

## 문제 처리
- 확실한 버그나 명세 위반은 직접 고치고, 고친 뒤 해당 항목을 다시 확인한다.
- 명세 자체를 바꿔야 하거나 판단이 애매한 사항은 고치지 말고 review.md에 "보류"로 적는다.

## review.md 형식
1. 요약 — 통과 여부 한두 줄
2. 검증 환경 — 무엇으로 어떻게 확인했는지
3. 체크리스트 결과 — spec.md 7장 항목별 ✅/❌/⚠️ 와 근거
4. 발견한 문제와 수정 내역 — 파일·내용
5. 보류 사항 / 확인하지 못한 것

## 보고
review.md 요약, 수정한 파일, 남은 문제를 한국어로 10줄 이내로 보고한다.
