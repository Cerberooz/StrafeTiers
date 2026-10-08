import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(process.argv[2] || '../../WebApps/WebApp/public/design');
const output = new URL('../assets/emojis/', import.meta.url);
await mkdir(output, { recursive: true });
for (const [input, name] of [
  ['minecraft-block.png', 'strafe_minecraft'],
  ['discord-symbol.svg', 'strafe_discord'],
  ['Teams_Icon.png', 'strafe_team'],
  ['Solo_Icon.png', 'strafe_solo']
]) {
  // Preserve the website artwork and alpha; rasterize SVG and fit within a transparent square.
  await sharp(resolve(source, input), { density: 192 }).trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(fileURLToPath(new URL(`${name}.png`, output)));
  console.log(`Prepared ${name}.png`);
}
