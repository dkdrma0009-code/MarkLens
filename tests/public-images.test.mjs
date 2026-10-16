import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const ts=require('typescript'), React=require('react'), {renderToStaticMarkup}=require('react-dom/server')
const {getImgProps}=require('next/dist/shared/lib/get-img-props'),{imageConfigDefault}=require('next/dist/shared/lib/image-config')
function load(file,mocks={}) {
 const loaded={exports:{}}
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 new Function('require','module','exports','__dirname',code)(name=>name in mocks?mocks[name]:require(name),loaded,loaded.exports,process.cwd())
 return loaded.exports
}
const images=load('src/lib/images.ts'), config=load('next.config.ts').default.images
const imgConf={...imageConfigDefault,...config}
const defaultLoader=require('next/dist/shared/lib/image-loader').default
const Image=props=>React.createElement('img',getImgProps(props,{imgConf,defaultLoader}).props)
const EditorialImage=load('src/components/home/EditorialImage.tsx',{'@/lib/images':images,'next/image':{default:Image}}).default
const ArticleVisual=load('src/components/insights/ArticleVisual.tsx',{'@/lib/images':images,'next/image':{default:Image}}).default
const source='https://images.unsplash.com/photo-example?fit=max&sig=keep'
test('loader canonicalizes existing CDN source without nesting or dropping original parameters',()=>{
 const direct=images.editorialImageLoader({src:source,width:768})
 assert.equal(direct,images.editorialImageLoader({src:source,width:768}))
 assert.equal(direct,images.editorialImageLoader({src:images.weservThumb(source,1440),width:768}))
 const u=new URL(direct);assert.equal(u.hostname,'images.weserv.nl');assert.equal(u.searchParams.get('w'),'768');assert.equal(u.searchParams.get('url'),source.replace('https://',''))
})
test('Vercel image optimization is off globally; public images use one CDN-sized src, never /_next/image',()=>{
 assert.equal(config.unoptimized,true); assert.equal(config.remotePatterns,undefined)
 for(const sizes of ['96px','(max-width: 767px) 100vw, 36vw','1320px']) {
 const {props}=getImgProps({src:images.editorialImageLoader({src:source,width:1440}),fill:true,sizes},{imgConf,defaultLoader})
 assert.ok(props.src.startsWith('https://images.weserv.nl/'));assert.equal(new URL(props.src).searchParams.get('w'),'1440');assert.ok(!props.src.includes('_next/image'));assert.equal(props.srcSet,undefined)
 }
})
test('rendered public/editorial and reused admin article preserve geometry, priority and blocked fallback',()=>{
 const insight={article:{image_url:source}}
 const eager=renderToStaticMarkup(React.createElement(EditorialImage,{insight,sizes:'36vw',eager:true}))
 assert.ok(eager.includes('fetchPriority="high"'));assert.ok(eager.includes('loading="eager"'));assert.ok(!eager.includes('_next/image'))
 const lazy=renderToStaticMarkup(React.createElement(EditorialImage,{insight,sizes:'96px'}));assert.ok(lazy.includes('loading="lazy"'))
 const blocked={image_url:'https://cdn.musebyclios.com/a.jpg',fallback_image:{url:source,credit:'Author',creditLink:'https://unsplash.com/author'}}
 const article=renderToStaticMarkup(React.createElement(ArticleVisual,{article:blocked}))
 assert.ok(article.includes('Author'));assert.ok(!article.includes('musebyclios'));assert.ok(article.includes('ml-article-image'));assert.match(article,/src="https:\/\/images\.weserv\.nl\/\?url=images\.unsplash\.com%2Fphoto-example%3Ffit%3Dmax%26sig%3Dkeep&amp;w=1600/)
 const proxied=renderToStaticMarkup(React.createElement(EditorialImage,{insight:{article:{image_url:images.weservThumb(source,440)}},sizes:'96px'}));assert.equal((proxied.match(/weserv/g)??[]).length,1)
 const empty=renderToStaticMarkup(React.createElement(ArticleVisual,{article:{image_url:blocked.image_url}}));assert.ok(empty.includes('기사 이미지 없음'));assert.ok(!empty.includes('<img'))
 assert.equal(images.isHotlinkBlocked(blocked.image_url),true)
})
