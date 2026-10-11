// Export only: canonical SVG paths are never reconstructed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import kit from '@pdf-lib/fontkit';
const root = process.cwd(), out = path.join(root,'public/brand');

fs.mkdirSync(out,{recursive:true});
const names = ['marklens-wordmark.svg','marklens-wordmark-reverse.svg','marklens-wordmark-signal.svg','marklens-mark.svg'];
const records = {};
for (const name of names) { const data=fs.readFileSync(path.join(out,name)); records[name]=crypto.createHash('sha256').update(data).digest('hex'); }
fs.copyFileSync(path.join(out,'marklens-mark.svg'),path.join(root,'src/app/icon.svg'));
const primary=fs.readFileSync(path.join(out,names[0]),'utf8');
const d=primary.match(/<path[^>]* d="([^"]+)"/)[1];
fs.mkdirSync(path.join(root,'src/lib/brand'),{recursive:true});
fs.writeFileSync(path.join(root,'src/lib/brand/WordmarkSvg.tsx'),`// Geometry copied from the approved canonical public/brand/marklens-wordmark.svg.\nconst PATH = ${JSON.stringify(d)}\n\nexport default function WordmarkSvg({ reverse = false, width = 145 }: { reverse?: boolean; width?: number }) {\n  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5170.73 1000.00" width={width} height={width / 5.17073} aria-label="MarkLens"><path fill={reverse ? "#FFFFFF" : "#101113"} fillRule="evenodd" d={PATH} /></svg>\n}\n`);
(async()=>{
  for (const reverse of [false,true]) await sharp(path.join(out,`marklens-wordmark${reverse?'-reverse':''}.svg`),{density:300}).resize({width:600}).png().toFile(path.join(out,`marklens-wordmark${reverse?'-reverse':''}.png`));
  for (const size of [16,32,48,180]) await sharp(path.join(out,'marklens-mark.svg'),{density:300}).resize(size,size).png().toFile(path.join(out,`marklens-mark-${size}.png`));
  const sizes = [16,32,48], entries = sizes.map(size => fs.readFileSync(path.join(out,`marklens-mark-${size}.png`)));
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  let offset = header.length;
  entries.forEach((data,i) => { const at=6+i*16; header[at]=sizes[i]; header[at+1]=sizes[i]; header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6); header.writeUInt32LE(data.length,at+8); header.writeUInt32LE(offset,at+12); offset+=data.length; });
  fs.writeFileSync(path.join(root,'src/app/favicon.ico'),Buffer.concat([header,...entries]));
  const mark=await sharp(path.join(out,'marklens-mark.svg'),{density:300}).resize(880,880).png().toBuffer();
  await sharp({create:{width:1080,height:1080,channels:4,background:'#0A0A0A'}}).composite([{input:mark,left:100,top:100}]).png().toFile(path.join(out,'marklens-instagram-1080.png'));

  const font=kit.create(fs.readFileSync(path.join(root,'public/fonts/Pretendard-Regular.woff2')));
  const run=font.layout('Weekly'); let x=0;
  const glyphs=run.glyphs.map((g,i)=>{const p=run.positions[i]; const node=`<path d="${g.path.toSVG()}" transform="translate(${x+p.xOffset},${p.yOffset})"/>`;x+=p.xAdvance;return node}).join('');
  const scale=730/font.unitsPerEm;
  const weekly=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${5370.73+x*scale} 1000" role="img" aria-label="MarkLens Weekly"><title>MarkLens Weekly</title><path fill="#101113" fill-rule="evenodd" d="${d}"/><g fill="#164BFF" transform="translate(5370.73,850) scale(${scale},-${scale})">${glyphs}</g></svg>\n`;
  fs.writeFileSync(path.join(out,'marklens-weekly.svg'),weekly);
  await sharp(Buffer.from(weekly),{density:300}).resize({width:900}).png().toFile(path.join(out,'marklens-weekly.png'));
  fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({system:'A2 Editorial Hybrid',canonical:'v3',approved:'2026-10-10',electricBlue:'#164BFF',minimumWordmarkWidth:120,minimumCompactSize:16,sha256:records,weeklyDescriptor:'Fixed Pretendard Regular outlines; master wordmark geometry unchanged',reference:'v2 reconstruction and approved raster retained outside product assets'},null,2)+'\n');
})();
