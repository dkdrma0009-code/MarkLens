// MarkLens Review Hub sync. Separate from the Quality Review on purpose: the review never depends on Notion.
//
//   node tools/review-hub-sync.mjs                       dry run: plan + previews, nothing written (default)
//   node tools/review-hub-sync.mjs --apply local         apply to a local hub file (.review-hub/state.json)
//   node tools/review-hub-sync.mjs --apply notion        apply to the Notion database (needs NOTION_TOKEN and
//                                                        NOTION_REVIEW_HUB_DATABASE_ID; otherwise reports CONNECTION REQUIRED)
// Options: --report <report.json> (default .quality-review/report.json), --state <hub pages json> (plan against a
// hub snapshot, e.g. exported by the Notion connector), --out <dir> (default .review-hub). Docs: docs/review-hub/README.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { applyLocal, dashboard, markdown, planSync } from './review-hub/hub.mjs'
import { notionClient } from './review-hub/notion.mjs'

const args = process.argv.slice(2)
const opt = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback }
const reportFile = opt('--report', '.quality-review/report.json'), out = opt('--out', '.review-hub'), apply = opt('--apply', null)
const localFile = path.join(out, 'state.json'), stateFile = opt('--state', apply === 'local' || !apply ? localFile : null)
mkdirSync(out, { recursive: true })

if (!existsSync(reportFile)) { console.error(`No Quality Review report at ${reportFile}. Run tools/quality-review.mjs first.`); process.exit(1) }
const report = JSON.parse(readFileSync(reportFile, 'utf8'))
if (!report.reviewItems) { console.error('This report has no reviewItems (Quality Review V1.1 or later is needed).'); process.exit(1) }
const now = report.runAt

// ---------- Run ----------
let pages = [], client = null
if (apply === 'notion') {
  const token = process.env.NOTION_TOKEN, databaseId = process.env.NOTION_REVIEW_HUB_DATABASE_ID
  if (!token || !databaseId) {
    console.log('CONNECTION REQUIRED: set NOTION_TOKEN (an internal integration shared with the Review Hub database) and NOTION_REVIEW_HUB_DATABASE_ID. Nothing was written.')
    process.exit(0)
  }
  client = notionClient({ token, databaseId }); pages = await client.pages()
} else if (stateFile && existsSync(stateFile)) pages = JSON.parse(readFileSync(stateFile, 'utf8')).pages
const { ops, counts, held } = planSync(report.reviewItems, pages, { now, sections: report.sections })
console.log(`${apply ? `APPLY ${apply}` : 'DRY RUN'}  CREATE ${counts.CREATE} · UPDATE ${counts.UPDATE} · REOPEN ${counts.REOPEN} · CLOSE ${counts.CLOSE} · 확인 시각만 갱신 ${counts.TOUCH}${held.length ? ` · 확인 못 해 그대로 둠 ${held.length}` : ''}`)
for (const op of ops.filter(op => op.op !== 'TOUCH')) console.log(`  ${op.op.padEnd(6)} [${op.status}] ${op.title}${op.note ? ` — ${op.note}` : ''}`)
for (const page of held) console.log(`  HOLD   [${page.status}] ${page.title} — 이번 검수에서 해당 검사가 실행되지 않아 완료로 바꾸지 않았습니다`)
const previews = ops.filter(op => op.body).map(op => `# ${op.title}\n\n${markdown(op.body)}`)
let after = pages
if (apply === 'notion') { for (const op of ops) await client.apply(op); after = await client.pages() }
else after = applyLocal(pages, ops, { now })
if (apply === 'local') writeFileSync(localFile, JSON.stringify({ updatedAt: now, pages: after }, null, 1))
writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ runAt: now, apply: apply ?? 'dry-run', counts, held, ops, dashboard: dashboard(after, { runAt: now, mode: report.mode }) }, null, 1))
writeFileSync(path.join(out, 'preview.md'), [dashboard(after, { runAt: now, mode: report.mode }), '', '---', '', ...previews].join('\n'))
console.log(`→ ${path.join(out, 'plan.json')}, ${path.join(out, 'preview.md')}`)
