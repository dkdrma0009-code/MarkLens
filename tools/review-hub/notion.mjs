// Review Hub — Notion REST adapter. Used only by tools/review-hub-sync.mjs --apply notion with NOTION_TOKEN and
// NOTION_REVIEW_HUB_DATABASE_ID. Writes pages of one database; never deletes anything. Docs: docs/review-hub/README.md.
import { parseRecord } from './hub.mjs'
// Property types of the hub database. "내 결정" is read only: a person owns it.
export const TYPES = { '제목': 'title', '상태': 'select', '중요도': 'select', '종류': 'select', '대상': 'multi_select', '이유': 'rich_text', '추천': 'rich_text', '선택지': 'rich_text',
  '발생일': 'date', '마지막 확인': 'date', '고유 키': 'rich_text', '검수 기록': 'rich_text' }
const text = value => [{ type: 'text', text: { content: String(value).slice(0, 2000) } }]
export const toNotionProperties = props => Object.fromEntries(Object.entries(props).map(([name, value]) => [name, {
  title: () => ({ title: text(value) }), select: () => ({ select: value ? { name: value } : null }), multi_select: () => ({ multi_select: value.map(name => ({ name })) }),
  rich_text: () => ({ rich_text: value ? text(value) : [] }), date: () => ({ date: { start: value } }) }[TYPES[name]]()]))
export const toBlocks = ({ main, details }) => [
  ...main.map(b => b.type === 'heading' ? { heading_3: { rich_text: text(b.text) } } : b.type === 'bullet' ? { bulleted_list_item: { rich_text: text(b.text) } } : { paragraph: { rich_text: text(b.text) } }),
  { divider: {} }, { toggle: { rich_text: text('자세히 보기'), children: details.map(d => ({ paragraph: { rich_text: text(d) } })) } }]
const plain = prop => (prop?.title ?? prop?.rich_text ?? []).map(t => t.plain_text).join('')
export function notionClient({ token, databaseId, fetchImpl = fetch }) {
  const api = async (route, method, payload) => {
    const res = await fetchImpl(`https://api.notion.com/v1${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, body: payload && JSON.stringify(payload) })
    const json = await res.json()
    if (!res.ok) throw new Error(`Notion ${res.status} ${json.code ?? ''}`.trim()) // the token is never printed
    return json
  }
  return {
    async pages() {
      const rows = []; let cursor
      do { const page = await api(`/databases/${databaseId}/query`, 'POST', cursor ? { start_cursor: cursor } : {}); rows.push(...page.results); cursor = page.has_more ? page.next_cursor : null } while (cursor)
      return rows.map(row => { const p = row.properties, record = plain(p['검수 기록']); return { id: row.id, key: plain(p['고유 키']), title: plain(p['제목']), status: p['상태']?.select?.name ?? null, importance: p['중요도']?.select?.name ?? null, decision: p['내 결정']?.select?.name ?? null, record: parseRecord(record) } }).filter(row => row.key)
    },
    async apply(op) {
      if (op.op === 'CREATE') return api('/pages', 'POST', { parent: { database_id: databaseId }, properties: toNotionProperties(op.properties), children: toBlocks(op.body) })
      await api(`/pages/${op.pageId}`, 'PATCH', { properties: toNotionProperties(op.properties) })
      if (op.note) await api(`/blocks/${op.pageId}/children`, 'PATCH', { children: [{ paragraph: { rich_text: text(op.note) } }] })
    },
  }
}

