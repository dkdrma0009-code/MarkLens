import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
const require=createRequire(import.meta.url)
const sql=readFileSync('supabase/migrations/017_insight_content_timestamp.sql','utf8')
const baseline=readFileSync('supabase/migrations/001_schema.sql','utf8')
const oldDate='2000-01-01T00:00:00.000Z'
async function fixture() {
 assert.ok(process.env.PGLITE_MODULE,'PGLITE_MODULE is required; SQL tests must not silently skip')
 const {PGlite}=require(process.env.PGLITE_MODULE),db=new PGlite()
 for(const table of ['articles','insights','newsletter_issues']) await db.exec(baseline.match(new RegExp(`CREATE TABLE ${table} \\([\\s\\S]*?\\n\\);`))[0])
 // These existing columns were confirmed through production OpenAPI (read-only).
 await db.exec(`ALTER TABLE insights ADD COLUMN hook text, ADD COLUMN video_url text, ADD COLUMN marketing_terms jsonb, ADD COLUMN quiz jsonb, ADD COLUMN legacy_slug text;`)
 await db.exec(baseline.match(/CREATE OR REPLACE FUNCTION update_updated_at\(\)[\s\S]*?LANGUAGE plpgsql;/)[0])
 // Install the actual baseline triggers, not a rewritten approximation.
 for(const table of ['articles','insights','newsletter_issues']) await db.exec(`CREATE TRIGGER ${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION update_updated_at();`)
 await db.exec(sql)
 await db.exec(sql) // repeat application is safe
 return db
}
async function insert(db,slug='a'){return (await db.query(`INSERT INTO insights(slug,category,updated_at,view_count) VALUES($1,'SEO',$2,3) RETURNING *`,[slug,oldDate])).rows[0]}
const stamp=row=>new Date(row.updated_at).toISOString()
test('actual SQL preserves timestamp for view-only, explicit timestamp, no-op and equivalent JSON updates',async()=>{
 const db=await fixture();try{
 const row=await insert(db)
 for(const statement of [`view_count=view_count+1`,`view_count=view_count+1,updated_at=now()`,`summary=summary`,`quiz=quiz`]) {
 const result=(await db.query(`UPDATE insights SET ${statement} WHERE id=$1 RETURNING *`,[row.id])).rows[0];assert.equal(stamp(result),oldDate)
 }
 const result=(await db.query('SELECT view_count FROM insights WHERE id=$1',[row.id])).rows[0];assert.equal(result.view_count,5)
 await db.query(`UPDATE insights SET quiz='{"a":1,"b":2}' WHERE id=$1`,[row.id])
 const before=(await db.query('SELECT updated_at FROM insights WHERE id=$1',[row.id])).rows[0]
 const after=(await db.query(`UPDATE insights SET quiz='{"b":2,"a":1}' WHERE id=$1 RETURNING updated_at`,[row.id])).rows[0];assert.equal(stamp(after),stamp(before))
 }finally{await db.close()}
})
test('every explicit content/editorial field advances timestamp including null-to-value and mixed metric writes',async()=>{
 const db=await fixture();try{
 const source=(await db.query(`INSERT INTO articles(title,url,source,source_name) VALUES('T','https://example.test','rss','S') RETURNING id`)).rows[0].id
 const fields={article_id:source,slug:'changed',legacy_slug:'legacy',created_at:'2001-01-01',is_featured:true,hook:'H',summary:'S',key_takeaways:['K'],why_it_matters:'W',practical_applications:'P',framework_analysis:'F',portfolio_usage:'U',interview_points:['I'],category:'Brand',tags:['T'],keywords:['Q'],video_url:'https://example.test/video',marketing_terms:JSON.stringify([{term:'T',definition:'D'}]),quiz:JSON.stringify({question:'Q'})}
 for(const [field,value] of Object.entries(fields)){
 const row=await insert(db,'case-'+field)
 const changed=(await db.query(`UPDATE insights SET ${field}=$1,view_count=view_count+1 WHERE id=$2 RETURNING *`,[value,row.id])).rows[0]
 assert.notEqual(stamp(changed),oldDate,field);assert.equal(changed.view_count,4)
 }
 }finally{await db.close()}
})
test('articles publication status and newsletter generic trigger remain unchanged; rollback restores metric timestamp behavior',async()=>{
 const db=await fixture();try{
 const article=(await db.query(`INSERT INTO articles(title,url,source,source_name,updated_at) VALUES('T','https://example.test/status','rss','S',$1) RETURNING id`,[oldDate])).rows[0]
 const changed=(await db.query(`UPDATE articles SET status='published' WHERE id=$1 RETURNING updated_at`,[article.id])).rows[0];assert.notEqual(stamp(changed),oldDate)
 const issue=(await db.query(`INSERT INTO newsletter_issues(issue_number,title,updated_at) VALUES(1,'T',$1) RETURNING id`,[oldDate])).rows[0]
 assert.notEqual(stamp((await db.query(`UPDATE newsletter_issues SET title='Edited' WHERE id=$1 RETURNING updated_at`,[issue.id])).rows[0]),oldDate)
 const row=await insert(db);await db.exec(sql.split('-- Rollback')[1].split('\n').slice(1).map(l=>l.replace(/^-- ?/,'')).join('\n'))
 assert.notEqual(stamp((await db.query(`UPDATE insights SET view_count=4 WHERE id=$1 RETURNING updated_at`,[row.id])).rows[0]),oldDate)
 }finally{await db.close()}
})
test('actual view POST handler increments the counter without changing content timestamp',async()=>{
 const db=await fixture();try{
 const row=await insert(db,'view-test'),ts=require('typescript'),loaded={exports:{}}
 function builder(){let kind,values,filter;return {from(){return this},select(){kind='read';return this},update(v){kind='write';values=v;return this},eq(k,v){filter={k,v};return this},async single(){return {data:(await db.query('SELECT id,view_count FROM insights WHERE slug=$1',[filter.v])).rows[0]}},then(resolve,reject){assert.equal(kind,'write');return db.query('UPDATE insights SET view_count=$1 WHERE id=$2',[values.view_count,filter.v]).then(resolve,reject)}}}
 const mocks={'@/lib/supabase/admin':{createAdminClient:builder},'@/lib/rate-limit':{checkRateLimit:()=>null},'next/server':{NextResponse:{json:body=>body}}}
 const code=ts.transpileModule(readFileSync('src/app/api/insights/[slug]/view/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 new Function('require','module','exports',code)(name=>mocks[name],loaded,loaded.exports)
 for(let i=0;i<2;i++)assert.deepEqual(await loaded.exports.POST({}, {params:Promise.resolve({slug:'view-test'})}),{ok:true})
 const after=(await db.query('SELECT * FROM insights WHERE id=$1',[row.id])).rows[0];assert.equal(after.view_count,5);assert.equal(stamp(after),oldDate)
 }finally{await db.close()}
})
test('existing SEO dateModified consumer and reduced Public contracts remain intact',()=>{
 const page=readFileSync('src/app/(public)/insights/[slug]/page.tsx','utf8'),contract=readFileSync('src/lib/insights/public-select.ts','utf8')
 assert.ok(page.includes('dateModified: insight.updated_at ?? insight.created_at'))
 assert.ok(contract.includes('created_at,updated_at'));assert.ok(!contract.includes('view_count,'));assert.ok(!contract.includes('raw_content,'))
})
