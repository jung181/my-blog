// 키보드·스와이프 입력을 방향('up'|'down'|'left'|'right')으로 변환한다

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
};

const SWIPE_MIN = 30; // 스와이프로 인식할 최소 거리(px)

// 포커스가 버튼·입력 요소에 있는지 확인
function isInteractive(el) {
  if (!el || !(el instanceof Element)) return false;
  return Boolean(el.closest('button, input, textarea, select, a[href], [contenteditable=""], [contenteditable="true"]'));
}

// onDirection(dir), onNewGame() 콜백을 연결한다
export function bindInput(board, { onDirection, onNewGame }) {
  // 키보드: document에서 받는다
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (isInteractive(e.target)) return;

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const dir = KEY_DIRECTIONS[key];
    if (dir) {
      e.preventDefault();
      onDirection(dir);
      return;
    }
    if (key === 'n') {
      e.preventDefault();
      onNewGame();
    }
  });

  // 스와이프: 터치·펜 포인터만 처리
  let start = null;

  board.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });

  board.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) onDirection(dx > 0 ? 'right' : 'left');
    else onDirection(dy > 0 ? 'down' : 'up');
  });

  board.addEventListener('pointercancel', () => {
    start = null;
  });

  // 보드를 클릭·탭하면 보드에 포커스 (iframe 안에서 키 입력을 받기 위해)
  board.addEventListener('click', (e) => {
    if (isInteractive(e.target)) return;
    board.focus({ preventScroll: true });
  });
}
