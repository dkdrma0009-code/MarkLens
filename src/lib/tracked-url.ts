export const PRODUCTION_SITE_URL = "https://marklens.site"
export const RELAUNCH_CAMPAIGN = "marklens_v2_relaunch"

export function buildTrackedUrl({ path, source, medium, campaign = RELAUNCH_CAMPAIGN, content }: {
  path: string; source: string; medium: string; campaign?: string; content: string
}): string {
  const url = new URL(path, PRODUCTION_SITE_URL)
  if (url.origin !== PRODUCTION_SITE_URL || url.username || url.password) throw new Error("Use a MarkLens production path")
  for (const [key, value] of Object.entries({ utm_source: source, utm_medium: medium, utm_campaign: campaign, utm_content: content })) {
    if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(value) || value.length > 80) throw new Error("Use stable lowercase ASCII UTM identifiers")
    url.searchParams.set(key, value)
  }
  return url.href
}

export const relaunchLinks = {
  instagramBio: buildTrackedUrl({ path: "/newsletter", source: "instagram", medium: "social", content: "ig_bio_01" }),
  instagramCarousel: buildTrackedUrl({ path: "/", source: "instagram", medium: "social", content: "ig_carousel_01" }),
  instagramReel: buildTrackedUrl({ path: "/", source: "instagram", medium: "social", content: "ig_reel_01" }),
  threads: buildTrackedUrl({ path: "/", source: "threads", medium: "social", content: "threads_launch_01" }),
  linkedin: buildTrackedUrl({ path: "/", source: "linkedin", medium: "social", content: "linkedin_launch_01" }),
  community: buildTrackedUrl({ path: "/", source: "community", medium: "community", content: "community_everytime_01" }),
  newsletter: buildTrackedUrl({ path: "/insights", source: "newsletter", medium: "email", content: "weekly_001" }),
}
