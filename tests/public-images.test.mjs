import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript'), React=require('react'), {renderToStaticMarkup}=require('react-dom/server')
function load(file,mocks={}) {
 const loaded={exports:{}}
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','module','exports','__dirname',code)(name=>name in mocks?mocks[name]:require(name),loaded,loaded.exports,process.cwd())
 return loaded.exports
}
const images=load('src/lib/images.ts'), config=load('next.config.ts').default.images
const CdnImage=load('src/components/media/CdnImage.tsx',{'@/lib/images':images})
const EditorialImage=load('src/components/home/EditorialImage.tsx',{'@/lib/images':images,'@/components/media/CdnImage':CdnImage}).default
const ArticleVisual=load('src/components/insights/ArticleVisual.tsx',{'@/lib/images':images,'@/components/media/CdnImage':CdnImage}).default
const srcsetOf=html=>(html.match(/srcSet="([^"]+)"/)?.[1]??'').replace(/&amp;/g,'&').split(', ').map(c=>{const [url,w]=c.split(' ');return {url,w:Number(w.slice(0,-1))}})
const source='https://images.unsplash.com/photo-example?fit=max&sig=keep'
test('loader canonicalizes existing CDN source without nesting or dropping original parameters',()=>{
 const direct=images.editorialImageLoader({src:source,width:768})
 assert.equal(direct,images.editorialImageLoader({src:source,width:768}))
 assert.equal(direct,images.editorialImageLoader({src:images.weservThumb(source,1440),width:768}))
 const u=new URL(direct);assert.equal(u.hostname,'images.weserv.nl');assert.equal(u.searchParams.get('w'),'768');assert.equal(u.searchParams.get('url'),source.replace('https://',''))
})
test('Vercel image optimization stays off; the browser picks a CDN width from srcset, never /_next/image',()=>{
 assert.equal(config.unoptimized,true); assert.equal(config.remotePatterns,undefined)
 for(const sizes of ['96px','(max-width: 767px) 100vw, 36vw','1320px']) {
 const html=renderToStaticMarkup(React.createElement(EditorialImage,{insight:{article:{image_url:source}},sizes}))
 assert.ok(html.includes(`sizes="${sizes}"`));assert.ok(!html.includes('_next/image'))
 const candidates=srcsetOf(html)
 assert.deepEqual(candidates.map(c=>c.w),[...images.CDN_WIDTHS])
 for(const c of candidates){const u=new URL(c.url);assert.equal(u.hostname,'images.weserv.nl');assert.equal(u.searchParams.get('w'),String(c.w));assert.equal(u.searchParams.get('url'),source.replace('https://',''))}
 }
 // Same fill geometry next/image produced (absolutely positioned, full size), so layout is unchanged.
 assert.match(renderToStaticMarkup(React.createElement(EditorialImage,{insight:{article:{image_url:source}},sizes:'96px'})),/style="position:absolute;height:100%;width:100%;left:0;top:0;right:0;bottom:0;color:transparent"/)
})
test('rendered public/editorial and reused admin article preserve geometry, priority and blocked fallback',()=>{
 const insight={article:{image_url:source}}
 const eager=renderToStaticMarkup(React.createElement(EditorialImage,{insight,sizes:'36vw',eager:true}))
 assert.ok(eager.includes('fetchPriority="high"'));assert.ok(eager.includes('loading="eager"'));assert.ok(!eager.includes('_next/image'))
 const lazy=renderToStaticMarkup(React.createElement(EditorialImage,{insight,sizes:'96px'}));assert.ok(lazy.includes('loading="lazy"'))
 const blocked={image_url:'https://cdn.musebyclios.com/a.jpg',fallback_image:{url:source,credit:'Author',creditLink:'https://unsplash.com/author'}}
 const article=renderToStaticMarkup(React.createElement(ArticleVisual,{article:blocked}))
 assert.ok(article.includes('Author'));assert.ok(!article.includes('musebyclios'));assert.ok(article.includes('ml-article-image'));assert.match(article,/src="https:\/\/images\.weserv\.nl\/\?url=images\.unsplash\.com%2Fphoto-example%3Ffit%3Dmax%26sig%3Dkeep&amp;w=1600/);assert.ok(article.includes('sizes="(max-width: 767px) calc(100vw - 40px)'));assert.ok(srcsetOf(article).some(c=>c.w===2560))
 const proxied=renderToStaticMarkup(React.createElement(EditorialImage,{insight:{article:{image_url:images.weservThumb(source,440)}},sizes:'96px'}));assert.ok(srcsetOf(proxied).every(c=>(c.url.match(/weserv/g)??[]).length===1))
 const empty=renderToStaticMarkup(React.createElement(ArticleVisual,{article:{image_url:blocked.image_url}}));assert.ok(empty.includes('기사 이미지 없음'));assert.ok(!empty.includes('<img'))
 assert.equal(images.isHotlinkBlocked(blocked.image_url),true)
})
