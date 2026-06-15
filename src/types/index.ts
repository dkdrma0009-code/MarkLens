export type ArticleStatus = 'pending' | 'analyzing' | 'ready' | 'published' | 'rejected'
export type NewsletterStatus = 'draft' | 'ready' | 'sent'
export type SubscriberStatus = 'active' | 'unsubscribed'

export interface Article {
  id: string
  title: string
  url: string
  source: string
  source_name: string
  author?: string
  published_at?: string
  raw_content?: string
  image_url?: string
  status: ArticleStatus
  created_at: string
  updated_at: string
}

export interface Insight {
  id: string
  article_id: string
  slug: string
  hook?: string
  summary?: string
  key_takeaways?: string[]
  why_it_matters?: string
  practical_applications?: string
  framework_analysis?: string
  portfolio_usage?: string
  interview_points?: string[]
  video_url?: string
  category: string
  tags?: string[]
  keywords?: string[]
  is_featured: boolean
  view_count: number
  created_at: string
  updated_at: string
  article?: Article
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  article_count: number
}

export interface NewsletterBodySection {
  subhead: string
  paragraphs: string[]
}

export interface NewsletterIssue {
  id: string
  issue_number: number
  title: string
  intro?: string
  // 한 주제 깊이형 (신규 구조)
  topic_headline?: string
  body_sections?: NewsletterBodySection[]
  key_takeaways?: string[]
  for_your_career?: string
  // 구 5섹션 구조 (과거 호 렌더 폴백용 — 신규 생성에는 미사용)
  week_signals?: string
  case_of_week?: string
  ai_brief?: string
  portfolio_insight?: string
  career_lens?: string
  status: NewsletterStatus
  scheduled_at?: string
  sent_at?: string
  open_rate?: number
  click_rate?: number
  created_at: string
  updated_at: string
}

export interface Subscriber {
  id: string
  email: string
  status: SubscriberStatus
  subscribed_at: string
  unsubscribed_at?: string
}

export interface RssSource {
  id: string
  name: string
  slug: string
  rss_url: string
  website_url: string
  is_active: boolean
  last_fetched_at?: string
  article_count: number
}

// ── 공모전·대외활동 시스템 (articles 패턴 복제) ──
export type CompetitionStatus = 'pending' | 'published' | 'rejected' | 'expired'
export type CompetitionPriority = 'red' | 'orange' | 'yellow' | 'green'

export interface Competition {
  id: string
  title: string
  organizer?: string
  source_url: string
  source_name: string
  thumbnail_url?: string | null
  description?: string
  category?: string
  deadline?: string
  start_date?: string
  prize?: string
  eligibility?: string
  job_fit?: string[]
  difficulty?: string
  matched_article_ids?: string[]   // 2차 확장
  past_winner_analysis?: string    // 2차 확장
  status: CompetitionStatus
  created_at: string
  updated_at: string
}

export interface CompetitionSource {
  id: string
  name: string
  slug: string
  source_url: string
  collect_type: 'rss' | 'scrape'
  is_active: boolean
  last_fetched_at?: string
  created_at: string
}
