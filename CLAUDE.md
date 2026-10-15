# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code가 따라야 할 지침입니다.

## 프로젝트 개요

마크다운(`.md`) 파일로 작성한 글을 읽어 블로그 웹사이트로 보여주는 정적 사이트입니다.

- **순수 HTML, CSS, JavaScript(Vanilla JS)만 사용**합니다. React, Vue, Svelte 같은 프레임워크나 Tailwind, Bootstrap 같은 CSS 프레임워크는 쓰지 않습니다.
- 빌드 도구(npm, webpack, Vite 등)도 사용하지 않습니다. 파일을 그대로 정적 서버에 올리면 동작해야 합니다.
- 마크다운 파서도 외부 라이브러리 없이 직접 구현합니다(`js/markdown.js`).

## 디렉터리 구조

```
my-blog/
├── index.html          # 단일 진입점 (글 목록 + 글 본문을 해시 라우팅으로 전환)
├── css/
│   └── style.css       # 전체 스타일, 라이트/다크 테마 변수 포함
├── js/
│   ├── app.js          # 라우팅, 글 목록/본문 렌더링
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   └── theme.js        # 다크 모드 토글 및 저장
├── posts/
│   ├── index.json      # 글 목록 매니페스트 (파일명 배열)
│   └── *.md            # 블로그 글
├── images/             # 글에 쓰는 이미지 (본문에서 images/파일명 으로 참조)
└── serve.js            # 개발용 정적 서버 (node serve.js)
```

## 동작 방식

1. 브라우저는 디렉터리 내용을 직접 읽을 수 없으므로 `posts/index.json`에 글 파일 목록을 둡니다.
   ```json
   ["2026-10-14-hello-world.md", "2026-10-15-second-post.md"]
   ```
2. `app.js`가 `fetch()`로 매니페스트와 각 `.md` 파일을 불러옵니다.
3. 각 글 상단의 front matter에서 메타데이터를 읽습니다.
   ```markdown
   ---
   title: 첫 번째 글
   date: 2026-10-14
   tags: [일상, 개발]
   description: 목록에 표시될 짧은 요약
   ---

   본문 내용...
   ```
4. 라우팅은 해시 기반으로 처리합니다.
   - `#/` → 글 목록 (날짜 내림차순)
   - `#/post/<파일명에서 .md를 뺀 slug>` → 글 본문
   - `#/tag/<태그>` → 태그별 글 목록
   - 없는 경로는 간단한 404 메시지를 보여줍니다.

**새 글 추가 방법:** `posts/`에 `.md` 파일을 만들고 `posts/index.json`에 파일명을 추가합니다.

## 로컬 실행

`fetch()`와 ES 모듈은 `file://` 프로토콜에서 동작하지 않으므로 반드시 로컬 서버로 엽니다.
이 PC에는 Python이 없으므로 외부 패키지 없이 만든 Node 서버(`serve.js`)를 씁니다.

```bash
node serve.js
```

그 다음 브라우저에서 `http://localhost:8000` 을 엽니다. (Python이 있다면 `python -m http.server 8000`, VS Code Live Server도 가능)
`serve.js`는 개발용 도구일 뿐이며, 사이트 자체는 어떤 정적 호스팅에서도 그대로 동작해야 합니다.

## 마크다운 파서 (`js/markdown.js`)

다음 문법을 지원해야 합니다.

- 제목 `#` ~ `######`
- 문단, 줄바꿈
- **굵게**, *기울임*, ~~취소선~~, `인라인 코드`
- 링크 `[텍스트](url)`, 이미지 `![대체텍스트](url)`
- 순서 없는/있는 목록 (중첩 1단계 이상)
- 인용문 `>`
- 펜스 코드 블록 ` ``` ` (언어 이름은 `class="language-xxx"`로 붙이기)
- 수평선 `---`
- 표 (GFM 스타일)

구현 원칙:
- **보안:** 본문 텍스트와 코드 블록 내용은 반드시 HTML 이스케이프(`&`, `<`, `>`, `"`, `'`)한 뒤 마크업을 적용합니다. `javascript:` 로 시작하는 링크는 막습니다.
- 블록 단위 파싱(줄 단위로 블록 구분) → 인라인 파싱 순서로 처리합니다.
- 코드 블록 내부에서는 인라인 문법을 적용하지 않습니다.
- 제목에는 자동으로 `id`를 붙여 앵커 링크가 가능하게 합니다.

## 디자인 원칙

### 깔끔하고 읽기 좋게
- 본문 최대 너비는 약 `680px`~`720px` (한 줄 약 35~40자 한글 기준)로 중앙 정렬합니다.
- 본문 글자 크기 `17px`~`18px`, 줄 간격 `1.75` 정도로 넉넉하게.
- 폰트는 시스템 폰트 스택을 기본으로 하고, 한글 가독성을 위해 Pretendard 같은 웹폰트를 선택적으로 사용합니다.
  ```css
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  ```
- `word-break: keep-all;`로 한글 단어 중간 줄바꿈을 방지합니다.
- 장식은 최소화하고 여백과 타이포그래피로 위계를 표현합니다. 강조색(accent)은 한 가지만 사용합니다.
- 코드 블록은 고정폭 폰트, 가로 스크롤(`overflow-x: auto`), 은은한 배경색을 사용합니다.

### 다크 모드
- 모든 색상은 `:root`의 CSS 변수로 정의하고, 컴포넌트에서는 변수만 참조합니다(하드코딩된 색상 금지).
  ```css
  :root { --bg: #ffffff; --text: #1f2328; --muted: #656d76; --accent: #2563eb; --border: #e5e7eb; --code-bg: #f6f8fa; }
  [data-theme="dark"] { --bg: #0d1117; --text: #e6edf3; --muted: #8b949e; --accent: #60a5fa; --border: #30363d; --code-bg: #161b22; }
  ```
- 초기 테마 결정 순서: `localStorage`에 저장된 값 → 없으면 `prefers-color-scheme` 시스템 설정.
- 헤더에 테마 토글 버튼을 둡니다. 선택값은 `localStorage`에 저장합니다(`try/catch`로 감싸기).
- **깜빡임(FOUC) 방지:** 테마를 결정하는 짧은 스크립트를 `<head>`에 인라인으로 넣어 렌더링 전에 `data-theme`을 설정합니다.
- 색 대비는 WCAG AA(본문 4.5:1 이상)를 지킵니다.

### 모바일 대응
- `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수.
- 모바일 우선(mobile-first)으로 작성하고 `min-width` 미디어 쿼리로 확장합니다.
- 좌우 여백은 모바일에서 최소 `16px`.
- 이미지, 표, 코드 블록이 화면 밖으로 넘치지 않게 합니다 (`img { max-width: 100%; height: auto; }`, 표와 코드는 가로 스크롤).
- 터치 대상(버튼, 링크)은 최소 `44px × 44px`.
- 페이지 전체에 가로 스크롤이 생기면 안 됩니다.

## 코딩 규칙

- ES 모듈(`<script type="module">`)을 사용하고 전역 변수를 만들지 않습니다.
- `var` 대신 `const`/`let`, 비동기는 `async/await`.
- 사용자 콘텐츠를 DOM에 넣을 때는 반드시 이스케이프를 거친 HTML만 `innerHTML`에 넣습니다.
- `fetch` 실패 시 사용자에게 오류 메시지를 보여줍니다.
- 시맨틱 태그(`<header>`, `<main>`, `<article>`, `<nav>`, `<time>`)를 사용하고 접근성(`aria-label`, 대체 텍스트, 키보드 포커스 표시)을 챙깁니다.
- 라우트가 바뀌면 `document.title`을 갱신하고 스크롤을 맨 위로 올립니다.
- 주석과 UI 문구는 한국어로 작성합니다.

## 변경 후 확인 사항

- 로컬 서버로 띄워 글 목록 → 글 본문 → 뒤로 가기가 정상 동작하는지 확인
- 라이트/다크 모드 전환 및 새로고침 후 유지 확인
- 모바일 폭(375px)에서 가로 스크롤이 없는지 확인
- 마크다운 문법 전체가 들어간 샘플 글로 렌더링 확인
