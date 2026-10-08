import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

for (const folder of ['src', 'scripts']) for (const name of await readdir(folder)) {
  if (!/\.m?js$/.test(name)) continue;
  const result = spawnSync(process.execPath, ['--check', `${folder}/${name}`], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('StrafeTiers source build passed.');
