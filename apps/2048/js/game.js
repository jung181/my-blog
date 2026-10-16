// 2048 순수 게임 로직 (DOM 없음, 부작용 없음)
// 상태: { size, tiles: [{ id, value, r, c }], score, won, over, nextId }

export const SIZE = 4;
export const WIN_VALUE = 2048;

// 방향별 벡터
const VECTORS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

// 상태 복사 (타일 객체까지 새로 만든다)
function cloneState(state) {
  return {
    ...state,
    tiles: state.tiles.map((t) => ({ ...t })),
  };
}

// 타일 배열 → 2차원 격자(칸마다 타일 또는 null)
function tileGrid(tiles, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  for (const t of tiles) grid[t.r][t.c] = t;
  return grid;
}

// 상태 → number[][] (빈칸 0)
export function toGrid(state) {
  const grid = Array.from({ length: state.size }, () => Array(state.size).fill(0));
  for (const t of state.tiles) grid[t.r][t.c] = t.value;
  return grid;
}

// number[][] → 상태 (저장 데이터 복원, 테스트용)
export function fromGrid(grid, { score = 0, won = false } = {}) {
  const size = grid.length;
  const tiles = [];
  let nextId = 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) tiles.push({ id: nextId++, value: grid[r][c], r, c });
    }
  }
  const state = { size, tiles, score, won, over: false, nextId };
  state.over = !canMove(state);
  return state;
}

// 빈칸 좌표 목록
export function emptyCells(state) {
  const grid = tileGrid(state.tiles, state.size);
  const cells = [];
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (!grid[r][c]) cells.push({ r, c });
    }
  }
  return cells;
}

// 무작위 빈칸에 타일 1개 생성 (90% 2, 10% 4). 새 상태와 생성된 타일을 반환한다.
export function spawnTile(state, rng = Math.random) {
  const cells = emptyCells(state);
  if (cells.length === 0) return { state, tile: null };
  const next = cloneState(state);
  const cell = cells[Math.min(cells.length - 1, Math.floor(rng() * cells.length))];
  const value = rng() < 0.9 ? 2 : 4;
  const tile = { id: next.nextId++, value, r: cell.r, c: cell.c };
  next.tiles.push(tile);
  return { state: next, tile: { ...tile } };
}

// 새 게임: 빈 보드에 타일 2개
export function createGame(rng = Math.random) {
  let state = { size: SIZE, tiles: [], score: 0, won: false, over: false, nextId: 1 };
  const spawned = [];
  for (let i = 0; i < 2; i++) {
    const res = spawnTile(state, rng);
    state = res.state;
    if (res.tile) spawned.push(res.tile);
  }
  return { state, spawned };
}

// 이동 가능 여부: 빈칸이 있거나 상하좌우로 인접한 같은 값이 있으면 true
export function canMove(state) {
  if (state.tiles.length < state.size * state.size) return true;
  const grid = toGrid(state);
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      const v = grid[r][c];
      if (c + 1 < state.size && grid[r][c + 1] === v) return true;
      if (r + 1 < state.size && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

// 한 방향으로 이동한다.
// 반환: { state, moved, scoreGained, merges, spawned, moves, justWon }
//  - moves: 기존 타일마다 { id, value, from: {r,c}, to: {r,c} }
//  - merges: 병합으로 생긴 타일마다 { id, value, to: {r,c}, mergedFrom: [id, id] }
//  - spawned: 새로 생긴 타일 { id, value, r, c } 또는 null
export function move(state, dir, rng = Math.random) {
  const vec = VECTORS[dir];
  if (!vec) throw new Error(`알 수 없는 방향: ${dir}`);
  const size = state.size;
  const grid = tileGrid(state.tiles, size);
  let nextId = state.nextId;
  let scoreGained = 0;
  let moved = false;
  const moves = [];
  const merges = [];
  const resultTiles = [];

  for (let line = 0; line < size; line++) {
    // 이동 방향의 앞쪽(벽에 가까운 쪽)부터 칸 좌표를 나열한다
    const cells = [];
    for (let i = 0; i < size; i++) {
      const k = vec.dr + vec.dc > 0 ? size - 1 - i : i;
      cells.push(vec.dr !== 0 ? { r: k, c: line } : { r: line, c: k });
    }

    let pos = 0; // 다음에 놓을 칸 인덱스
    let last = null; // 직전에 놓인(아직 병합되지 않은) 타일 정보
    for (const cell of cells) {
      const tile = grid[cell.r][cell.c];
      if (!tile) continue;
      if (last && !last.merged && last.value === tile.value) {
        // 병합: 같은 칸으로 이동한 뒤 새 타일 하나만 남긴다
        const to = last.to;
        moves.push({ id: tile.id, value: tile.value, from: { r: cell.r, c: cell.c }, to: { ...to } });
        const value = tile.value * 2;
        const merged = { id: nextId++, value, r: to.r, c: to.c };
        merges.push({ id: merged.id, value, to: { ...to }, mergedFrom: [last.id, tile.id] });
        // 직전 타일을 결과에서 병합 타일로 교체
        resultTiles[last.index] = merged;
        last.merged = true;
        scoreGained += value;
        moved = true;
      } else {
        const to = cells[pos];
        pos++;
        if (to.r !== cell.r || to.c !== cell.c) moved = true;
        moves.push({ id: tile.id, value: tile.value, from: { r: cell.r, c: cell.c }, to: { ...to } });
        resultTiles.push({ id: tile.id, value: tile.value, r: to.r, c: to.c });
        last = { id: tile.id, value: tile.value, to, merged: false, index: resultTiles.length - 1 };
      }
    }
  }

  // 무효 이동: 상태·점수·타일 생성 모두 그대로
  if (!moved) {
    return { state, moved: false, scoreGained: 0, merges: [], spawned: null, moves: [], justWon: false };
  }

  let next = {
    ...state,
    tiles: resultTiles,
    score: state.score + scoreGained,
    nextId,
  };

  // 처음으로 2048을 만들면 승리
  let justWon = false;
  if (!state.won && merges.some((m) => m.value === WIN_VALUE)) {
    next.won = true;
    justWon = true;
  }

  const res = spawnTile(next, rng);
  next = res.state;
  next.over = !canMove(next);

  return { state: next, moved: true, scoreGained, merges, spawned: res.tile, moves, justWon };
}

// 보드의 가장 큰 타일 값
export function maxTile(state) {
  return state.tiles.reduce((m, t) => Math.max(m, t.value), 0);
}
