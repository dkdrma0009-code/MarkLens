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

export interface NewsletterIssue {
  id: string
  issue_number: number
  title: string
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
