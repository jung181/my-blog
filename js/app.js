import { escapeHtml, markdownToHtml, parseFrontMatter } from './markdown.js';
import { initTheme } from './theme.js';

const SITE_TITLE = '나의 블로그';
const WORDS_PER_MINUTE = 500; // 한글 기준 분당 읽는 글자 수

const app = document.getElementById('app');
let postsPromise = null;
let renderCount = 0;

/* ===================== 데이터 ===================== */

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다. (HTTP ${res.status})`);
  return res.text();
}

async function fetchPosts() {
  const files = JSON.parse(await fetchText('posts/index.json'));
  if (!Array.isArray(files)) throw new Error('posts/index.json 은 파일명 배열이어야 합니다.');

  const results = await Promise.allSettled(
    files.map(async (file, order) => {
      const { data, body } = parseFrontMatter(await fetchText(`posts/${encodeURIComponent(file)}`));
      const slug = file.replace(/\.md$/i, '');
      return {
        slug,
        title: data.title || slug,
        date: typeof data.date === 'string' ? data.date : '',
        tags: Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [],
        description: data.description || '',
        body,
        html: null, // 처음 열 때 변환해서 저장
        order, // 날짜가 같으면 index.json에서 뒤에 있는 글을 최신으로 본다
      };
    }),
  );

  // 글 하나가 실패해도 나머지는 보여준다
  for (const result of results) {
    if (result.status === 'rejected') console.error(result.reason);
  }

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
}

function loadPosts() {
  if (!postsPromise) {
    postsPromise = fetchPosts().catch((error) => {
      postsPromise = null; // 다음 이동 때 다시 시도
      throw error;
    });
  }
  return postsPromise;
}

/* ===================== 포맷 ===================== */

function formatDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return escapeHtml(date);
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

function readingMinutes(body) {
  const chars = body.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / WORDS_PER_MINUTE));
}

const postHref = (slug) => escapeHtml(`#/post/${encodeURIComponent(slug)}`);
const tagHref = (tag) => escapeHtml(`#/tag/${encodeURIComponent(tag)}`);

function dateHtml(date) {
  return date ? `<time datetime="${escapeHtml(date)}">${formatDate(date)}</time>` : '';
}

function tagsHtml(tags) {
  if (!tags.length) return '';
  const items = tags
    .map((tag) => `<li><a class="tag" href="${tagHref(tag)}">#${escapeHtml(tag)}</a></li>`)
    .join('');
  return `<ul class="tags" aria-label="태그">${items}</ul>`;
}

/* ===================== 화면 ===================== */

function postListHtml(posts) {
  if (!posts.length) return '<p class="status">아직 작성된 글이 없어요.</p>';
  const items = posts
    .map(
      (post) => `
      <li class="post-item">
        <article>
          <h2><a href="${postHref(post.slug)}">${escapeHtml(post.title)}</a></h2>
          <div class="meta">${dateHtml(post.date)}</div>
          ${post.description ? `<p class="description">${escapeHtml(post.description)}</p>` : ''}
          ${tagsHtml(post.tags)}
        </article>
      </li>`,
    )
    .join('');
  return `<ul class="post-list">${items}</ul>`;
}

function homeView(posts) {
  // 웹앱 카드는 index.html의 <template>에 직접 작성한 정적 마크업이다
  const appCards = document.getElementById('app-cards')?.innerHTML ?? '';
  return {
    title: '',
    html: `
      ${appCards}
      <h1 class="page-title">최근 글</h1>
      <p class="page-subtitle">총 ${posts.length}개의 글</p>
      ${postListHtml(posts)}`,
  };
}

function tagView(posts, tag) {
  const tagged = posts.filter((post) => post.tags.includes(tag));
  if (!tagged.length) return notFoundView();
  return {
    title: `#${tag}`,
    html: `
      <h1 class="page-title">#${escapeHtml(tag)}</h1>
      <p class="page-subtitle">${tagged.length}개의 글</p>
      ${postListHtml(tagged)}
      <a class="back-link" href="#/">← 전체 글 보기</a>`,
  };
}

function navLink(post, label, className) {
  if (!post) return '';
  return `
    <a class="${className}" href="${postHref(post.slug)}">
      <span class="label">${label}</span>
      ${escapeHtml(post.title)}
    </a>`;
}

function postView(posts, slug) {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return notFoundView();

  const post = posts[index];
  post.html ??= markdownToHtml(post.body);

  // 목록은 최신순이므로 index + 1 이 더 오래된(이전) 글
  const older = posts[index + 1];
  const newer = posts[index - 1];
  const nav = older || newer
    ? `<nav class="post-nav" aria-label="이전 글과 다음 글">
        ${navLink(older, '← 이전 글', 'prev')}
        ${navLink(newer, '다음 글 →', 'next')}
      </nav>`
    : '';

  return {
    title: post.title,
    html: `
      <article>
        <header class="post-header">
          <h1 class="page-title">${escapeHtml(post.title)}</h1>
          <div class="meta">
            ${dateHtml(post.date)}
            <span>${readingMinutes(post.body)}분 분량</span>
          </div>
          ${tagsHtml(post.tags)}
        </header>
        <div class="prose">${post.html}</div>
      </article>
      ${nav}
      <a class="back-link" href="#/">← 글 목록으로</a>`,
  };
}

function notFoundView() {
  return {
    title: '페이지를 찾을 수 없어요',
    html: `
      <h1 class="page-title">페이지를 찾을 수 없어요</h1>
      <p class="page-subtitle">주소가 바뀌었거나 삭제된 글일 수 있어요.</p>
      <a class="back-link" href="#/">← 글 목록으로</a>`,
  };
}

function errorView(error) {
  const isFile = location.protocol === 'file:';
  const hint = isFile
    ? `<p>파일을 직접 열면 글을 불러올 수 없어요. 프로젝트 폴더에서 로컬 서버를 실행한 뒤
         <code>http://localhost:8000</code> 으로 열어주세요.</p>
       <pre><code>python -m http.server 8000</code></pre>`
    : `<p>${escapeHtml(error.message)}</p>`;
  return {
    title: '오류',
    html: `
      <h1 class="page-title">글을 불러오지 못했어요</h1>
      <div class="prose">${hint}</div>`,
  };
}

/* ===================== 라우터 ===================== */

function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

function parseRoute() {
  const path = location.hash.replace(/^#/, '') || '/';
  if (!path.startsWith('/')) return { name: 'notFound' };
  const parts = path.split('/').filter(Boolean).map(safeDecode);

  if (parts.length === 0) return { name: 'home' };
  if (parts.length === 2 && parts[0] === 'post') return { name: 'post', slug: parts[1] };
  if (parts.length === 2 && parts[0] === 'tag') return { name: 'tag', tag: parts[1] };
  return { name: 'notFound' };
}

// 웹앱 미리보기 iframe 높이를 내용에 맞춘다 (같은 출처일 때만 가능, 실패하면 CSS 기본 높이 유지)
function fitFrameHeight(iframe) {
  iframe.addEventListener('load', () => {
    try {
      const body = iframe.contentDocument.body;
      const fit = () => {
        iframe.style.height = `${Math.ceil(body.getBoundingClientRect().height)}px`;
      };
      new ResizeObserver(fit).observe(body);
      fit();
    } catch {
      // 다른 출처라 접근할 수 없으면 그대로 둔다
    }
  });
}

async function render() {
  const current = ++renderCount;
  const route = parseRoute();

  let view;
  try {
    const posts = await loadPosts();
    if (route.name === 'home') view = homeView(posts);
    else if (route.name === 'post') view = postView(posts, route.slug);
    else if (route.name === 'tag') view = tagView(posts, route.tag);
    else view = notFoundView();
  } catch (error) {
    console.error(error);
    view = errorView(error);
  }

  // 불러오는 사이 다른 주소로 이동했다면 이전 결과는 버린다
  if (current !== renderCount) return;

  app.innerHTML = view.html;
  app.querySelectorAll('.app-frame iframe').forEach(fitFrameHeight);
  document.title = view.title ? `${view.title} · ${SITE_TITLE}` : SITE_TITLE;
  window.scrollTo(0, 0);
  if (current > 1) app.focus({ preventScroll: true }); // 화면 낭독기가 새 내용을 읽도록
}

// "#제목" 같은 문서 안 링크는 라우터 대신 해당 위치로 스크롤한다
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (href.startsWith('#/')) return;

  event.preventDefault();
  const target = document.getElementById(safeDecode(href.slice(1)));
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (target === app) app.focus({ preventScroll: true });
});

window.addEventListener('hashchange', render);
history.scrollRestoration = 'manual'; // 화면을 매번 새로 그리므로 스크롤은 직접 관리한다

initTheme();
document.getElementById('year').textContent = new Date().getFullYear();
render();
