import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
 const loaded = { exports: {} }
 const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
 new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
 return loaded.exports
}
const contract = load('src/lib/insights/public-select.ts')
const base = { id:'A', slug:'article-a', category:'SEO', is_featured:false, created_at:'2026-01-01', hook:'Hook', summary:'Summary', tags:['search'], keywords:['AI'], view_count:99, updated_at:'metric-change', article:{title:'Title', source_name:'Source', image_url:'https://example.test/a.jpg', raw_content:'PRIVATE RAW TEXT', status:'published', fallback_image:{url:'https://example.test/f.jpg', internal:'private'}} }
test('public card projection strips operational data while preserving search, dates and images',()=>{
 const card=contract.publicCard(base)
 assert.equal(card.hook,base.hook); assert.deepEqual(card.tags,base.tags)
 assert.equal(card.article.fallback_image.url,base.article.fallback_image.url)
 for(const field of ['raw_content','view_count','updated_at','PRIVATE RAW TEXT','internal','status']) assert.ok(!JSON.stringify(card).includes(field))
 for(const select of [contract.PUBLIC_INSIGHT_CARD_SELECT,contract.PUBLIC_HOME_SELECT,contract.PUBLIC_INSIGHT_DETAIL_SELECT]) {assert.ok(!select.includes('*')); assert.ok(!select.includes('raw_content')); assert.ok(!select.includes('view_count'))}
 for(const field of ['quiz','marketing_terms','why_it_matters','portfolio_usage','video_url','updated_at']) assert.ok(contract.PUBLIC_INSIGHT_DETAIL_SELECT.includes(field))
})
test('exact revalidation covers new/edit/delete slugs, never unrelated B or route pattern',()=>{
 for(const slugs of [['article-a'],['new-slug'],['deleted-slug'],['article-a','article-a','']]) {
  const paths=[]; const {revalidatePublicContent}=load('src/lib/revalidate.ts',{'next/cache':{revalidatePath:p=>paths.push(p)}})
  revalidatePublicContent({ slugs })
  assert.deepEqual(paths,['/','/insights',...new Set(slugs.filter(Boolean).map(s=>`/insights/${s}`))])
  assert.ok(!paths.includes('/insights/article-b')); assert.ok(!paths.includes('/insights/[slug]'))
 }
})
function handler(file, rows) {
 const paths=[]; const selections=[]
 const chain={ from(){return this},update(){return this},delete(){return this},eq(){return this},in(){return this},select(s){selections.push(s);return this},single(){return Promise.resolve({data:rows[0],error:null})},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)}}
 const client={...chain,auth:{getUser:async()=>({data:{user:{email:'admin@example.test'}}})}}
 const exports=load(file,{'@/lib/supabase/admin':{createAdminClient:()=>client},'@/lib/supabase/server':{createClient:async()=>({auth:client.auth})},'@/lib/api-auth':{isAdmin:async()=>true},'@/lib/revalidate':load('src/lib/revalidate.ts',{'next/cache':{revalidatePath:p=>paths.push(p)}}),'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}}})
 return {exports,paths,selections}
}
test('actual admin edit/delete handlers invalidate only the stored slug',async()=>{
 for(const method of ['PATCH','DELETE']) {
  const h=handler('src/app/api/admin/insights/[id]/route.ts',[{slug:'article-a',article_id:'source-a'}])
  const result=await h.exports[method]({json:async()=>({hook:'Edited'})},{params:Promise.resolve({id:'A'})})
  assert.equal(result.status,200); assert.deepEqual(h.paths,['/','/insights','/insights/article-a']); assert.ok(h.selections.some(s=>s.includes('slug')))
 }
})
test('actual status publish/unpublish handlers resolve and target the changed article slug',async()=>{
 for(const status of ['published','ready']) {
  const h=handler('src/app/api/articles/[id]/status/route.ts',[{slug:'article-a',hook:'Hook',summary:'Summary'}])
  const result=await h.exports.PATCH({json:async()=>({status})},{params:Promise.resolve({id:'source-a'})})
  assert.equal(result.status,200); assert.deepEqual(h.paths,['/','/insights','/insights/article-a'])
 }
})
test('actual bulk publish targets valid published slugs, no invalid backlog or whole-detail pattern',async()=>{
 const old=process.env.ADMIN_EMAIL;process.env.ADMIN_EMAIL='admin@example.test'
 try {
 const h=handler('src/app/api/admin/publish-all/route.ts',[{id:'A',insights:[{slug:'article-a',hook:'H',summary:'S'}]},{id:'B',insights:[{slug:'article-b',hook:'',summary:'S'}]}])
 const result=await h.exports.POST();assert.equal(result.body.published,1);assert.deepEqual(h.paths,['/','/insights','/insights/article-a'])
 } finally {if(old===undefined)delete process.env.ADMIN_EMAIL;else process.env.ADMIN_EMAIL=old}
})
