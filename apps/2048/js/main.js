// 모듈 연결, 이벤트 바인딩, 테마 동기화

import { createGame, move, fromGrid, toGrid, maxTile, SIZE } from './game.js';
import { createRenderer } from './render.js';
import { bindInput } from './input.js';
import { getBest, setBest, loadGameState, saveGameState } from './storage.js';

// ---- 테마 동기화 (블로그와 같은 'theme' 키 공유) ----
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch (e) {
    return null;
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = storedTheme() || (darkQuery.matches ? 'dark' : 'light');
}

// 부모 페이지(블로그)에서 테마를 토글하면 반영
window.addEventListener('storage', (e) => {
  if (e.key === 'theme' || e.key === null) applyTheme();
});

// 저장된 테마가 없을 때만 시스템 설정 변화를 반영
darkQuery.addEventListener('change', () => {
  if (!storedTheme()) applyTheme();
});

// ---- 게임 ----
const board = document.querySelector('.board');
const renderer = createRenderer({
  tileLayer: document.querySelector('.tile-layer'),
  score: document.querySelector('#score'),
  best: document.querySelector('#best'),
  scoreBox: document.querySelector('.score-box-current'),
  live: document.querySelector('#live-polite'),
  alert: document.querySelector('#live-assertive'),
  winOverlay: document.querySelector('#overlay-win'),
  overOverlay: document.querySelector('#overlay-over'),
  finalScore: document.querySelector('#final-score'),
});

let state = null;
let best = getBest();

function persist() {
  saveGameState({ grid: toGrid(state), score: state.score, won: state.won });
}

function updateBest() {
  if (state.score > best) {
    best = state.score;
    setBest(best);
  }
}

function newGame() {
  state = createGame().state;
  renderer.hideOverlays();
  renderer.reset(state);
  renderer.setScore(state.score, best);
  persist();
}

function handleDirection(dir) {
  if (renderer.isOverlayOpen()) return; // 오버레이가 열려 있으면 방향 입력 무시
  const result = move(state, dir);
  if (!result.moved) return;

  state = result.state;
  updateBest();
  renderer.update(result);
  renderer.setScore(state.score, best, result.scoreGained);
  if (result.scoreGained > 0) {
    renderer.announce(`점수 ${state.score}점, 최고 타일 ${maxTile(state)}`);
  }
  persist();

  if (result.justWon) renderer.showWin();
  else if (state.over) renderer.showOver(state.score);
}

// 저장된 게임이 있으면 이어 하고, 없거나 깨졌으면 새 게임
function start() {
  const saved = loadGameState(SIZE);
  if (!saved) {
    newGame();
    return;
  }
  state = fromGrid(saved.grid, { score: saved.score, won: saved.won });
  updateBest();
  renderer.reset(state);
  renderer.setScore(state.score, best);
  if (state.over) renderer.showOver(state.score);
}

// 오버레이 버튼
document.querySelector('#btn-new').addEventListener('click', newGame);
document.querySelector('#btn-win-new').addEventListener('click', () => {
  newGame();
  board.focus({ preventScroll: true });
});
document.querySelector('#btn-continue').addEventListener('click', () => {
  renderer.hideOverlays();
  // 2048을 만든 이동으로 더 이상 움직일 수 없게 됐다면 바로 게임 오버를 띄운다
  if (state.over) {
    renderer.showOver(state.score);
    return;
  }
  board.focus({ preventScroll: true });
});
document.querySelector('#btn-retry').addEventListener('click', () => {
  newGame();
  board.focus({ preventScroll: true });
});

bindInput(board, { onDirection: handleDirection, onNewGame: newGame });

start();
