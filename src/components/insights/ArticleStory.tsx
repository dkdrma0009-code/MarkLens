import type { ComponentProps, ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import ArticleVisual from "./ArticleVisual"
import InsightQuiz from "@/components/InsightQuiz"
import InterviewSoundbites from "@/components/InterviewSoundbites"
import ShareButtons from "@/components/ShareButtons"

export interface ArticleStoryData {
  id: string; slug: string; category: string; created_at: string; hook?: string | null; summary?: string | null;
  key_takeaways?: string[] | null; why_it_matters?: string | null; framework_analysis?: string | null;
  practical_applications?: string | null; portfolio_usage?: string | null; interview_points?: string[] | null;
  marketing_terms?: { term: string; definition: string }[] | null; quiz?: ComponentProps<typeof InsightQuiz>["quiz"] | null; video_url?: string | null;
  article?: (NonNullable<ComponentProps<typeof ArticleVisual>["article"]> & {title?: string; source_name?: string; author?: string; url?: string; status?: string; id?: string}) | null
}
export function articleStoryToc(insight: ArticleStoryData, terms: {term:string;definition:string}[]) {
  return [insight.summary && {id:"summary",label:"핵심 요약"}, insight.key_takeaways?.length && {id:"takeaways",label:"무슨 일이 있었나"},
    insight.why_it_matters && {id:"why",label:"왜 중요한가"}, insight.framework_analysis && {id:"framework",label:"MarkLens의 해석"},
    insight.practical_applications && {id:"apply",label:"실전 적용법"}, insight.portfolio_usage && {id:"portfolio",label:"포트폴리오에 활용하기"},
    insight.interview_points?.length && {id:"interview",label:"면접 한 마디"}, terms.length && {id:"terms",label:"마케팅 용어"},
    (insight.quiz?.questions?.length || insight.quiz?.question) && {id:"learn",label:"학습 퀴즈"}].filter(Boolean) as {id:string;label:string}[]
}
export default function ArticleStory({ insight, title, terms, toc, color, midCta = () => null, children, preview = false }: {
  insight: ArticleStoryData; title: string; terms: {term:string;definition:string}[]; toc: {id:string;label:string}[];
  color: string; midCta?: (id:string)=>ReactNode; children?: ReactNode; preview?: boolean
}) {
  const article=insight.article
  return <>
        <header className="ml-article-header">
          <Link href="/insights" className="ml-article-back"><ArrowLeft size={16} aria-hidden="true" /> 인사이트 목록</Link>
          <p className="ml-eyebrow"><Link href={`/insights?category=${encodeURIComponent(insight.category)}`}>{insight.category}</Link><span> / {article?.source_name || "MARKLENS"}</span></p>
          <h1>{title}</h1>
          {article?.title && article.title !== title ? <p className="ml-article-deck">{article.title}</p> : null}
          <div className="ml-article-meta">
            <div><span>{article?.source_name}</span>{article?.author ? <span>{article.author}</span> : null}<span>분석 <time dateTime={insight.created_at}>{new Date(insight.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" })}</time></span></div>
            <div className="ml-article-sharing">{article?.url ? <a href={article.url} target="_blank" rel="noopener noreferrer">원문 보기 <ExternalLink size={14} aria-hidden="true" /></a> : null}{!preview && <ShareButtons slug={insight.slug} title={title} />}</div>
          </div>
        </header>
        <ArticleVisual key={insight.id} article={article} />
        <div className="ml-article-reading">
          {toc.length >= 3 ? <nav aria-label="목차" className="ml-article-toc"><details><summary>IN THIS STORY <span>목차</span></summary><ol>{toc.map(t => <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>)}</ol></details></nav> : null}
          <div className="ml-article-body">
            {insight.summary ? <Section id="summary" title="핵심 요약"><SentenceText text={insight.summary} className="ml-article-summary" /></Section> : null}
            {midCta("summary")}
            {insight.key_takeaways?.length ? <Section id="takeaways" title="무슨 일이 있었나"><ol className="ml-article-takeaways">{insight.key_takeaways.map((item: string, i: number) => <li key={i}><span>{String(i + 1).padStart(2, "0")}</span><SentenceText text={item} /></li>)}</ol></Section> : null}
            {midCta("takeaways")}
            {insight.why_it_matters ? <Section id="why" title="마케터에게 왜 중요한가"><Prose text={insight.why_it_matters} /></Section> : null}
            {midCta("why")}
            {insight.framework_analysis ? <Section id="framework" title="MarkLens의 해석"><Prose text={insight.framework_analysis} /></Section> : null}
            {midCta("framework")}
            {insight.practical_applications ? <Section id="apply" title="실무에 어떻게 적용할까"><Prose text={insight.practical_applications} /></Section> : null}
            {midCta("apply")}
            {insight.portfolio_usage || insight.interview_points?.length ? <div className="ml-article-career"><p className="ml-eyebrow">FROM INSIGHT TO CAREER</p>
              {insight.portfolio_usage ? <Section id="portfolio" title="포트폴리오에 활용하기"><Prose text={insight.portfolio_usage} /><Link href="/insight-lab" className="ml-text-link">Insight Lab에서 관점 정리하기 →</Link></Section> : null}
              {midCta("portfolio")}
              {insight.interview_points?.length ? <Section id="interview" title="면접에서 이렇게 말해보세요"><InterviewSoundbites items={insight.interview_points} color={color} /><Link href="/interview" className="ml-text-link">면접 연습으로 연결하기 →</Link></Section> : null}
              {midCta("interview")}
            </div> : null}
            {terms.length ? <Section id="terms" title="이 글의 마케팅 용어"><dl className="ml-article-terms">{terms.map((t, i) => <div key={i}><dt>{t.term}</dt><dd>{t.definition}</dd></div>)}</dl><Link href="/glossary" className="ml-text-link">전체 마케팅 용어 사전 보기 →</Link></Section> : null}
            {midCta("terms")}
            {(insight.quiz?.questions?.length || insight.quiz?.question) ? <Section id="learn" title="읽은 내용을 내 것으로"><p className="ml-utility-deck">짧은 퀴즈로 핵심 개념을 확인해보세요.</p><div className="ml-article-quiz"><InsightQuiz quiz={insight.quiz} color={color} /></div></Section> : null}
            {insight.video_url ? <Section title="관련 영상"><div className="ml-article-video"><VideoEmbed url={insight.video_url} /></div></Section> : null}
            {children}
          </div>
        </div>
  </>
}

const SECTION_LABELS: Record<string, string> = {
  summary: "SUMMARY", takeaways: "WHAT HAPPENED", why: "WHY IT MATTERS",
  framework: "MARKLENS TAKE / FRAMEWORK", apply: "HOW TO USE IT",
  portfolio: "FOR YOUR PORTFOLIO", interview: "FOR YOUR INTERVIEW",
  terms: "TERMS TO KNOW", learn: "READ / THINK / APPLY",
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return <section id={id} className={`ml-article-section${id === "framework" ? " ml-article-take" : ""}`}>
    {id ? <p className="ml-eyebrow">{SECTION_LABELS[id]}</p> : null}
    <h2>{title}</h2>{children}
  </section>
}

function Prose({ text }: { text: string }) {
  return <div className="ml-article-prose">{text.split(/\n+/).filter(Boolean).map((p, i) => <p key={i}><InlineText text={p} /></p>)}</div>
}

function InlineText({ text }: { text: string }) {
  return <>{text.split(/('[^']{1,40}')/g).map((part, i) => part.startsWith("'") && part.endsWith("'") ? <mark key={i} className="ml-article-quote">{part.slice(1, -1)}</mark> : <span key={i}>{part}</span>)}</>
}

function SentenceText({ text, className }: { text: string; className?: string }) {
  return <p className={className}><InlineText text={text} /></p>
}

function VideoEmbed({ url }: { url: string }) {
  const youtubeId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1]
  if (youtubeId) {
    return <iframe src={`https://www.youtube.com/embed/${youtubeId}`}
      title="관련 영상" className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1]
  if (vimeoId) {
    return <iframe src={`https://player.vimeo.com/video/${vimeoId}`}
      title="관련 영상" className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
  }
  return null
}
