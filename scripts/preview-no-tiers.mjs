// Local visual mockup using the actual embed builder; no Discord login or API key required.
import { createServer } from 'node:http';
import { profileEmbed } from '../src/profile.js';

const embed = profileEmbed({ playerName: 'ExamplePlayer', premium: false, standings: [], notFound: true }, {}).toJSON();
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const html = `<!doctype html><meta charset="utf-8"><title>StrafeTiers — no tiers preview</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#313338;color:#f2f3f5;font:16px Arial,sans-serif;padding:32px}
.label{color:#b5bac1;font-size:13px;margin:0 0 12px}.embed{width:520px;min-height:132px;background:#2b2d31;border-left:4px solid #74757b;border-radius:4px;padding:16px;display:flex;gap:20px}
.copy{flex:1;padding-top:1px}.title{font-size:16px;font-weight:700;margin:0 0 16px;line-height:22px}.description{margin:0;color:#dbdee1;line-height:22px}.portrait{width:96px;height:96px;object-fit:contain}
</style><div class="label">StrafeTiers · /tier ExamplePlayer · preview</div>
<div class="embed"><div class="copy"><div class="title">${escape(embed.title)}</div><p class="description">${escape(embed.description)}</p></div><img class="portrait" alt="Default Steve portrait" src="${escape(embed.thumbnail.url)}"></div>`;

const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html);
});
server.listen(5047, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:5047'));
