import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ASCII 전용 슬러그. 한글(가-힣) 등 비-ASCII 를 제거한다 — 한글 슬러그가 Next 캐시 태그를
// 통해 x-next-cache-tags 헤더(Latin1)를 깨뜨려 500 이 나므로 URL 은 ASCII 만 쓴다.
export function slugify(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // ASCII 영숫자·공백·하이픈만 (한글·특수문자 제거)
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

// 인사이트 슬러그: 영문 title 우선 → hook → 폴백 "insight", 끝에 -<id6> 유니크 해시.
// 영문 제목이면 읽기 좋은 SEO 슬러그, 한글-only 면 base 가 비어 "insight-<id6>"(ID형).
export function buildInsightSlug(title: string | null, hook: string | null, id: string): string {
  const base = slugify(title || "") || slugify(hook || "") || "insight"
  return `${base}-${id.slice(0, 6)}`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
