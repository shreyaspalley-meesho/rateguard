import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(process.cwd(), 'out');
const src = resolve(outDir, 'index.html');
const dst = resolve(outDir, '404.html');

if (!existsSync(src)) {
  console.error('[post-export] out/index.html not found — did next build run?');
  process.exit(1);
}

await copyFile(src, dst);
console.log('[post-export] wrote out/404.html');
