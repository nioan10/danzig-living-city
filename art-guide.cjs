const fs = require('node:fs');
const sharp = require('C:/Users/alale/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const W = require('./world.js');
fs.mkdirSync('assets', {recursive:true});
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100"><rect width="1600" height="1100" fill="#809265"/><path d="M1370 0 Q1320 180 1410 380 T1400 850 L1380 1100 H1600 V0Z" fill="#326471"/><polygon points="${W.wall.map(p=>p.join(',')).join(' ')}" fill="#aaa082" stroke="#665d4c" stroke-width="18"/>`];
for (const [x,y,w,h] of [[70,540,135,130],[75,700,110,115],[70,850,90,140],[275,790,70,130]]) parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#c9ac58"/>`);
for(const e of W.edges){const a=W.nodes[e.a],b=W.nodes[e.b];parts.push(`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#e7d5ad" stroke-width="${e.width}" fill="none"/>`);}
for(const b of W.buildings())parts.push(`<rect x="${b.x-b.w/2}" y="${b.y-b.h/2}" width="${b.w}" height="${b.h}" fill="${b.type==='church'?'#792f24':'#a25232'}" stroke="#372f27"/><text x="${b.x}" y="${b.y}" font-size="12" text-anchor="middle" fill="white">${b.type==='home'?'house':b.id}</text>`);
for(const id of W.gates){const n=W.nodes[id];parts.push(`<circle cx="${n.x}" cy="${n.y}" r="14" fill="#e5c992"/>`);}
parts.push('</svg>');
sharp(Buffer.from(parts.join(''))).png().toFile('assets/city-layout-guide.png');
