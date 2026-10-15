// 외부 라이브러리 없이 구현한 마크다운 → HTML 변환기.
// 원칙: 모든 텍스트는 먼저 HTML 이스케이프한 뒤 마크업을 입힌다. (원본 HTML 태그는 글자로 보인다)

const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const FENCE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^`\s]*)[^`]*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}>/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
const TABLE_SEP_RE = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

/** HTML 특수문자를 이스케이프한다. */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unquote(value) {
  return value.replace(/^(["'])(.*)\1$/, '$2');
}

/**
 * 글 맨 앞의 `---` 블록(front matter)을 읽는다.
 * @returns {{ data: Record<string, string | string[]>, body: string }}
 */
export function parseFrontMatter(text) {
  const normalized = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(normalized);
  if (!match) return { data: {}, body: normalized };

  const data = {};
  for (const line of match[1].split('\n')) {
    const m = /^([\w-]+)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!m) continue;
    const raw = m[2].trim();
    data[m[1]] = /^\[.*\]$/.test(raw)
      ? raw.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean)
      : unquote(raw);
  }
  return { data, body: normalized.slice(match[0].length) };
}

/** 마크다운 본문을 HTML 문자열로 변환한다. */
export function markdownToHtml(markdown) {
  const lines = String(markdown)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, (ws) => ws.replace(/\t/g, '    ')));
  return parseBlocks(lines, { ids: new Map() }, false);
}

/* ===================== 블록 ===================== */

const isBlank = (line) => /^[ \t]*$/.test(line);
const indentOf = (line) => /^ */.exec(line)[0].length;

function startsBlock(line) {
  return (
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line)
  );
}

function isTableStart(lines, i) {
  return (
    i + 1 < lines.length &&
    lines[i].includes('|') &&
    TABLE_SEP_RE.test(lines[i + 1]) &&
    (lines[i + 1].includes('|') || lines[i].trim().startsWith('|'))
  );
}

/**
 * @param {string[]} lines
 * @param {{ ids: Map<string, number> }} ctx 문서 전체에서 공유하는 상태 (제목 id 중복 방지)
 * @param {boolean} tight 촘촘한 목록 안에서는 문단을 <p>로 감싸지 않는다
 */
function parseBlocks(lines, ctx, tight) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    // 펜스 코드 블록
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const [, indent, marker, lang] = fence;
      const closeRe = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}[ \\t]*$`);
      const code = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        code.push(lines[i].slice(Math.min(indent.length, indentOf(lines[i]))));
        i++;
      }
      i++; // 닫는 펜스 건너뛰기
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    // 제목
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = parseInline(heading[2] || '');
      const id = uniqueId(slugify(content), ctx);
      out.push(`<h${level} id="${id}">${content}</h${level}>`);
      i++;
      continue;
    }

    // 수평선 (목록보다 먼저 검사: "- - -"는 수평선)
    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 인용문
    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length) {
        const current = lines[i];
        if (QUOTE_RE.test(current)) {
          inner.push(current.replace(/^ {0,3}> ?/, ''));
        } else if (!isBlank(current) && !startsBlock(current) && inner.length && !isBlank(inner[inner.length - 1])) {
          inner.push(current); // 게으른 이어쓰기
        } else {
          break;
        }
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(inner, ctx, false)}\n</blockquote>`);
      continue;
    }

    // 표
    if (isTableStart(lines, i)) {
      const result = parseTable(lines, i);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // 목록
    if (LIST_RE.test(line)) {
      const result = parseList(lines, i, ctx);
      out.push(result.html);
      i = result.next;
      continue;
    }

    // 문단
    const para = [];
    while (i < lines.length && !isBlank(lines[i])) {
      if (para.length && (startsBlock(lines[i]) || isTableStart(lines, i))) break;
      para.push(lines[i].replace(/^ +/, ''));
      i++;
    }
    const content = parseInline(para.join('\n'));
    out.push(tight ? content : `<p>${content}</p>`);
  }

  return out.join('\n');
}

function parseList(lines, start, ctx) {
  const first = LIST_RE.exec(lines[start]);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;

  const items = []; // { lines: string[], contentIndent: number }
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const m = HR_RE.test(line) ? null : LIST_RE.exec(line);

    // 같은 깊이의 새 항목
    if (m && m[1].length === baseIndent) {
      if (/\d/.test(m[2]) !== ordered) break;
      const spacing = m[3] ? Math.min(m[3].length, 4) : 1;
      items.push({ lines: [m[4] || ''], contentIndent: baseIndent + m[2].length + spacing });
      i++;
      continue;
    }

    const item = items[items.length - 1];

    if (isBlank(line)) {
      let j = i;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;

      const nextLine = lines[j];
      const nextItem = LIST_RE.exec(nextLine);
      const continuesItem = indentOf(nextLine) > baseIndent;
      const continuesList =
        nextItem && nextItem[1].length === baseIndent && /\d/.test(nextItem[2]) === ordered && !HR_RE.test(nextLine);

      if (!continuesItem && !continuesList) break;
      loose = true;
      if (continuesItem) item.lines.push('');
      i = j;
      continue;
    }

    // 들여쓴 줄은 현재 항목의 내용 (중첩 목록 포함)
    if (indentOf(line) > baseIndent) {
      item.lines.push(line.slice(Math.min(indentOf(line), item.contentIndent)));
      i++;
      continue;
    }

    // 게으른 이어쓰기: 들여쓰지 않았지만 새 블록이 아닌 줄
    if (!startsBlock(line) && !isBlank(item.lines[item.lines.length - 1])) {
      item.lines.push(line);
      i++;
      continue;
    }

    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const body = items.map((item) => `<li>${parseBlocks(item.lines, ctx, !loose)}</li>`).join('\n');
  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines, start) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });

  const cell = (tag, text, col) => {
    const align = aligns[col] ? ` style="text-align:${aligns[col]}"` : '';
    return `<${tag}${align}>${parseInline(text || '')}</${tag}>`;
  };

  const thead = `<tr>${header.map((text, col) => cell('th', text, col)).join('')}</tr>`;
  const rows = [];
  let i = start + 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    rows.push(`<tr>${header.map((_, col) => cell('td', cells[col], col)).join('')}</tr>`);
    i++;
  }

  const tbody = rows.length ? `<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  return {
    html: `<div class="table-wrap"><table>\n<thead>${thead}</thead>\n${tbody}\n</table></div>`,
    next: i,
  };
}

/* ===================== 제목 id ===================== */

function slugify(html) {
  const text = html
    .replace(/<[^>]+>/g, '')
    .replace(/&(?:[a-z]+|#\d+);/gi, '')
    .toLowerCase()
    .trim();
  const slug = text
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || 'section';
}

function uniqueId(slug, ctx) {
  const count = ctx.ids.get(slug) || 0;
  ctx.ids.set(slug, count + 1);
  return count ? `${slug}-${count + 1}` : slug;
}

/* ===================== 인라인 ===================== */

/** 위험한 URL 스킴을 막는다. url은 이미 이스케이프된 상태로 들어온다. */
function safeUrl(url) {
  const decoded = url.replace(/&amp;/g, '&').replace(/[\u0000- \u007f]/g, '').toLowerCase();
  return /^(javascript|vbscript|data):/.test(decoded) ? '#' : url;
}

function linkHtml(url, label, title) {
  const href = safeUrl(url);
  const titleAttr = title ? ` title="${title}"` : '';
  const external = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${href}"${titleAttr}${external}>${label}</a>`;
}

function applyEmphasis(s) {
  return s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>');
}

// 링크/이미지의 (주소 "제목") 부분. 주소 안의 괄호는 한 단계까지 허용한다: (https://ko.wikipedia.org/wiki/A_(B))
const LINK_TARGET = String.raw`\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)`;

function parseInline(text) {
  const tokens = [];
  // 이미 처리한 조각은 자리표시자로 빼 두어 이후 규칙이 건드리지 않게 한다
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

  let s = escapeHtml(text);

  // 인라인 코드
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => stash(`<code>${code.replace(/^ (.*) $/s, '$1')}</code>`));

  // 백슬래시 이스케이프
  s = s.replace(/\\(&gt;|&lt;|&amp;|&quot;|&#39;|[\\`*_{}[\]()#+\-.!~|])/g, (_, ch) => stash(ch));

  // 꺾쇠 자동 링크 <https://...>
  s = s.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, url) => stash(linkHtml(url, url)));

  // 이미지
  s = s.replace(new RegExp(`!\\[([^\\]]*)\\]${LINK_TARGET}`, 'g'), (_, alt, url, title) => {
    const titleAttr = title ? ` title="${title}"` : '';
    return stash(`<img src="${safeUrl(url)}" alt="${alt}"${titleAttr} loading="lazy">`);
  });

  // 링크
  s = s.replace(new RegExp(`\\[([^\\]]+)\\]${LINK_TARGET}`, 'g'), (_, label, url, title) =>
    stash(linkHtml(url, applyEmphasis(label), title)),
  );

  // 그냥 적은 URL
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<\u0000]*[^\s<\u0000.,:;!?'")\]])/g, (_, before, url) =>
    before + stash(linkHtml(url, url)),
  );

  s = applyEmphasis(s);

  // 강제 줄바꿈: 줄 끝 공백 2개 이상 또는 백슬래시
  s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');

  // 자리표시자 복원 (중첩될 수 있으므로 반복)
  while (/\u0000\d+\u0000/.test(s)) {
    s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[Number(n)]);
  }
  return s;
}
