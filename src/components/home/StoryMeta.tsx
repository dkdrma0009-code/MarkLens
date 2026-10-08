import { dateInfo, formatDate, type HomeInsight } from "./data"

export default function StoryMeta({ insight }: { insight: HomeInsight }) {
  const date = dateInfo(insight)
  return <div className="ml-meta"><span>{insight.article?.source_name || "MarkLens"}</span><span>{date.label} <time dateTime={date.value}>{formatDate(date.value)}</time></span></div>
}
