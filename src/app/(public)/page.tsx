import type { Metadata } from "next"
import { createPublicClient } from "@/lib/supabase/server"
import Hero from "@/components/home/Hero"
import Pulse from "@/components/home/Pulse"
import MainStory from "@/components/home/MainStory"
import Signals from "@/components/home/Signals"
import LatestInsights from "@/components/home/LatestInsights"
import TrendToAction from "@/components/home/TrendToAction"
import Collections from "@/components/home/Collections"
import Weekly from "@/components/home/Weekly"
import HomeMotion from "@/components/home/HomeMotion"
import { headline, hasImage, unusedStories, selectMainStory, selectCollections, selectSignals, type HomeInsight } from "@/components/home/data"

export const metadata: Metadata = {
  title: "MarkLens — Where Marketing Trends Become Action",
  description: "Marketing × Trend × Intelligence. 글로벌 마케팅 트렌드의 변화와 맥락을 읽고, 실무와 커리어에 적용할 인사이트를 전합니다.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "MarkLens — Where Marketing Trends Become Action",
    description: "마케팅 트렌드를 읽고, 실무를 준비하다. 마케터를 위한 트렌드와 실무 인사이트.",
    url: "https://marklens.site",
    siteName: "MarkLens",
    type: "website",
  },
}

export const revalidate = 3600

// 발행된 공개 콘텐츠만 조회. raw_content 등 본문 전체를 홈으로 전달하지 않는다.
const HOME_SELECT = "id, slug, hook, summary, category, is_featured, created_at, practical_applications, framework_analysis, portfolio_usage, article:articles!inner(title, source_name, image_url, fallback_image, site_published_at)"

export default async function HomePage() {
  const supabase = createPublicClient()
  const until = new Date().toISOString()
  const since = new Date(new Date(until).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const [recentResult, featuredResult, signalsResult] = await Promise.all([
    supabase.from("insights").select(HOME_SELECT).eq("articles.status", "published").order("created_at", { ascending: false }).limit(60).returns<HomeInsight[]>(),
    supabase.from("insights").select(HOME_SELECT).eq("articles.status", "published").eq("is_featured", true).order("created_at", { ascending: false }).limit(5).returns<HomeInsight[]>(),
    supabase.from("insights").select(HOME_SELECT).eq("articles.status", "published").gte("created_at", since).lte("created_at", until).order("created_at", { ascending: false }).limit(20).returns<HomeInsight[]>(),
  ])
  const recent = (recentResult.data ?? []).filter(i => i.slug && headline(i))
  const story = selectMainStory(recent, featuredResult.data ?? [])
  const hero = unusedStories(recent, story ? [story] : []).find(hasImage)
  const anchors = [story, hero].filter((i): i is HomeInsight => !!i)
  const weekly = unusedStories((signalsResult.data ?? []).filter(i => i.slug && headline(i)), anchors)
  const signals = selectSignals([...weekly.filter(i => i.summary?.trim()), ...weekly.filter(i => !i.summary?.trim())], 3)
  const pulse = selectSignals(unusedStories(recent, [...anchors, ...signals]))
  const latest = unusedStories(recent, [...anchors, ...signals, ...pulse]).slice(0, 4)
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marklens.site"
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "MarkLens",
        url: base,
        logo: `${base}/icon.svg`,
        description: "마케팅 트렌드를 분석하고 실무에 바로 적용 가능한 인사이트를 제공합니다.",
        sameAs: ["https://www.instagram.com/marklens.site", "https://www.threads.com/@marklens.site"],
      },
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: "MarkLens",
        url: base,
        inLanguage: "ko-KR",
        publisher: { "@id": `${base}/#organization` },
      },
    ],
  }
  const unavailable = !!(recentResult.error || featuredResult.error || signalsResult.error)

  return (
    <HomeMotion>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <Hero story={hero} />
      {unavailable ? <p className="ml-container ml-data-notice" role="status">일부 콘텐츠를 불러오지 못했습니다. 잠시 후 다시 방문해주세요.</p> : null}
      <Pulse insights={pulse} />
      <MainStory insight={story} />
      <Signals insights={signals} since={since} until={until} />
      <LatestInsights insights={latest} />
      <TrendToAction insight={recent.find(i => i.framework_analysis || i.practical_applications) ?? story} />
      <Collections collections={selectCollections(recent)} />
      <Weekly />
    </HomeMotion>
  )
}
