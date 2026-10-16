// localStorage 래퍼: 저장소를 쓸 수 없으면 메모리 값으로만 동작한다

const BEST_KEY = '2048-best';
const STATE_KEY = '2048-state';

// 저장소 실패 시 사용할 메모리 값
const memory = new Map();

function read(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch (e) {
    // 시크릿 모드·차단 환경: 메모리 값 사용
  }
  return memory.has(key) ? memory.get(key) : null;
}

function write(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // 저장 실패는 무시하고 메모리 값만 유지
  }
}

function remove(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // 무시
  }
}

// 최고 점수
export function getBest() {
  const n = Number.parseInt(read(BEST_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setBest(value) {
  write(BEST_KEY, String(value));
}

// 2의 거듭제곱(2 이상)인지 확인
function isTileValue(v) {
  return Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0;
}

// 진행 중인 게임 상태 { grid, score, won }. 깨진 데이터면 null
export function loadGameState(size) {
  const raw = read(STATE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const { grid, score, won } = data || {};
    const validGrid =
      Array.isArray(grid) &&
      grid.length === size &&
      grid.every(
        (row) => Array.isArray(row) && row.length === size && row.every((v) => v === 0 || isTileValue(v))
      );
    if (!validGrid || !Number.isInteger(score) || score < 0 || typeof won !== 'boolean') return null;
    // 타일이 하나도 없으면 의미 없는 상태
    if (!grid.some((row) => row.some((v) => v !== 0))) return null;
    return { grid, score, won };
  } catch (e) {
    return null;
  }
}

export function saveGameState(data) {
  try {
    write(STATE_KEY, JSON.stringify(data));
  } catch (e) {
    // 직렬화 실패는 무시
  }
}

export function clearGameState() {
  remove(STATE_KEY);
}
