// 다크 모드 토글. 초기 테마는 index.html <head>의 인라인 스크립트가 이미 정해 둔다.

const STORAGE_KEY = 'theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function getSavedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장소를 쓸 수 없어도 현재 화면에는 적용된다
  }
}

function applyTheme(theme, button) {
  root.dataset.theme = theme;
  if (button) {
    button.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  }
}

export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light', button);

  button?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, button);
    saveTheme(next);
  });

  // 사용자가 직접 고른 적이 없으면 시스템 설정 변화를 따라간다
  media.addEventListener('change', (event) => {
    if (!getSavedTheme()) {
      applyTheme(event.matches ? 'dark' : 'light', button);
    }
  });
}
