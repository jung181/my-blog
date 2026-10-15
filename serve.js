// 개발용 정적 파일 서버 (외부 패키지 없음). 실행: node serve.js [포트]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 'EACCES' });
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');

    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch (error) {
    const status = error.code === 'EACCES' ? 403 : 404;
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 403 ? '403 Forbidden' : '404 Not Found');
  }
}).listen(PORT, () => {
  console.log(`블로그 서버 실행 중: http://localhost:${PORT}`);
});
