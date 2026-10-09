"use client"
import { useState } from "react"
import { Tabs } from "@base-ui/react/tabs"
import CardnewsStudio from "@/app/admin/cardnews/[articleId]/CardnewsStudio"
import ReelStudio from "./ReelStudio"
import useSocialOperations from "./useSocialOperations"
import SocialActions from "./SocialActions"
import SocialResults from "./SocialResults"
import { socialDate, type CardnewsRow } from "./types"

export default function SocialStudio({ row, initialCategory, initialFormat }: { row: CardnewsRow; initialCategory: string; initialFormat?: string }) {
  const [format, setFormat] = useState(initialFormat === "reel" ? "reel" : "carousel")
  const ops = useSocialOperations({ initialRows: [row], autoPublish: false })
  const current = ops.rows[0]
  return <div className="social-studio">
    <div className="social-studio-state"><span>{current.postedAt ? "Carousel 게시 기록 있음" : "Carousel 미게시"} · {current.reelsPostedAt ? "Reel 게시 기록 있음" : "Reel 게시 기록 없음"}</span><span>예약 {socialDate(current.scheduledAt)}</span><SocialActions row={current} ops={ops} studio /></div>
    <Tabs.Root value={format} onValueChange={value => setFormat(String(value))} className="social-studio-tabs"><Tabs.List aria-label="Social format"><Tabs.Tab value="carousel">Carousel</Tabs.Tab><Tabs.Tab value="reel">Reel</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="carousel" keepMounted><CardnewsStudio articleId={row.articleId} initialSlides={row.slides || null} initialCategory={initialCategory} initialCaption={row.caption} onSaved={(slides, caption) => { ops.patchRow(row.articleId, { slides, caption, cardAt: new Date().toISOString() }); ops.setReelPreview(null) }} /></Tabs.Panel>
      <Tabs.Panel value="reel" keepMounted><ReelStudio row={current} ops={ops} /></Tabs.Panel>
    </Tabs.Root>
    <SocialResults ops={ops} />
  </div>
}
