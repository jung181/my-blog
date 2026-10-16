// 상태 → DOM 렌더링: 타일 배치·애니메이션, 점수, aria-live, 오버레이

const SLIDE_MS = 100; // CSS의 이동 전환 시간과 맞춘다
const SCORE_POP_MS = 700;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// 타일 값 → 클래스 이름
function tileClass(value) {
  return value > 2048 ? 'tile-super' : `tile-${value}`;
}

// 자릿수에 따라 글자 크기 단계 클래스
function digitsClass(value) {
  const len = String(value).length;
  if (len >= 4) return 'digits-4';
  if (len === 3) return 'digits-3';
  return '';
}

export function createRenderer(els) {
  const { tileLayer, score, best, scoreBox, live, alert, winOverlay, overOverlay, finalScore } = els;
  const tiles = new Map(); // id → { el, inner }
  let pending = null; // 이동 후 확정 대기 중인 작업
  let timer = 0;

  function setPosition(el, r, c) {
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
  }

  function setValue(entry, value, animClass) {
    entry.inner.className = ['tile-inner', tileClass(value), digitsClass(value), animClass]
      .filter(Boolean)
      .join(' ');
    entry.inner.textContent = String(value);
  }

  function addTile(tile, animClass) {
    const el = document.createElement('div');
    el.className = 'tile';
    const inner = document.createElement('div');
    el.append(inner);
    const entry = { el, inner };
    setPosition(el, tile.r, tile.c);
    setValue(entry, tile.value, animClass);
    tileLayer.append(el);
    tiles.set(tile.id, entry);
  }

  function removeTile(id) {
    const entry = tiles.get(id);
    if (!entry) return;
    entry.el.remove();
    tiles.delete(id);
  }

  // 이동이 끝난 뒤: 병합된 두 타일을 지우고 새 타일을 만든다
  function finalize() {
    if (!pending) return;
    const { merges, spawned } = pending;
    pending = null;
    clearTimeout(timer);
    for (const m of merges) {
      for (const id of m.mergedFrom) removeTile(id);
      addTile({ id: m.id, value: m.value, r: m.to.r, c: m.to.c }, 'tile-merged');
    }
    if (spawned) addTile(spawned, 'tile-new');
  }

  // 진행 중인 애니메이션을 즉시 최종 상태로 확정한다
  function flush() {
    tileLayer.classList.add('is-settling');
    finalize();
    for (const { inner } of tiles.values()) {
      inner.classList.remove('tile-new', 'tile-merged');
    }
    // 전환 없이 최종 위치를 반영한 뒤 전환을 다시 켠다
    void tileLayer.offsetWidth;
    tileLayer.classList.remove('is-settling');
  }

  // 보드 전체를 새로 그린다 (새 게임, 복원)
  function reset(state) {
    flush();
    tileLayer.replaceChildren();
    tiles.clear();
    for (const t of state.tiles) addTile(t, 'tile-new');
  }

  // move() 결과를 애니메이션과 함께 반영한다
  function update(result) {
    flush();
    for (const m of result.moves) {
      const entry = tiles.get(m.id);
      if (entry) setPosition(entry.el, m.to.r, m.to.c);
    }
    pending = { merges: result.merges, spawned: result.spawned };
    if (reducedMotion.matches) finalize();
    else timer = setTimeout(finalize, SLIDE_MS);
  }

  // 점수판 갱신. gained > 0이면 증가분을 잠깐 띄운다
  function setScore(current, bestValue, gained = 0) {
    score.textContent = String(current);
    best.textContent = String(bestValue);
    if (gained > 0) {
      const pop = document.createElement('span');
      pop.className = 'score-add';
      pop.setAttribute('aria-hidden', 'true');
      pop.textContent = `+${gained}`;
      scoreBox.append(pop);
      setTimeout(() => pop.remove(), SCORE_POP_MS);
    }
  }

  // 스크린리더 안내 (polite)
  function announce(text) {
    live.textContent = text;
  }

  // 스크린리더 안내 (assertive): 같은 문구도 다시 읽히도록 비운 뒤 넣는다
  function shout(text) {
    alert.textContent = '';
    setTimeout(() => {
      alert.textContent = text;
    }, 50);
  }

  function openOverlay(overlay) {
    overlay.hidden = false;
    const first = overlay.querySelector('button');
    if (first) first.focus();
  }

  function showWin() {
    openOverlay(winOverlay);
    shout('2048 달성! 계속하거나 새 게임을 시작할 수 있습니다.');
  }

  function showOver(finalValue) {
    finalScore.textContent = String(finalValue);
    openOverlay(overOverlay);
    shout(`게임 오버. 최종 점수 ${finalValue}점.`);
  }

  function hideOverlays() {
    winOverlay.hidden = true;
    overOverlay.hidden = true;
  }

  function isOverlayOpen() {
    return !winOverlay.hidden || !overOverlay.hidden;
  }

  return { reset, update, flush, setScore, announce, showWin, showOver, hideOverlays, isOverlayOpen };
}
