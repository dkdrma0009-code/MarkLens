"use client"

import { useMemo } from "react"
import { Player } from "@remotion/player"
import {
  ReelComposition, calcReelDurationInFrames, pickReelSlides,
  DEFAULT_REEL_SETTINGS, FPS, type ReelSettings,
} from "@/remotion/ReelComposition"
import type { Slide } from "@/lib/cardnews/types"
import type { ReelPhotos } from "@/lib/shorts/reel-photos"

const SLIDE_LABELS: Record<Slide["type"], string> = {
  cover: "표지", fact: "무슨 일", why: "왜 중요", apply: "실전", keywords: "키워드", cta: "구독",
}
// 릴스에 넣을 수 있는 후보. 순서 = 화면에 뜨는 순서.
const CANDIDATES: Slide["type"][] = ["cover", "fact", "why", "apply", "keywords", "cta"]

export default function ReelPreview({
  slides, category, coverImage, photos, settings, onChange,
}: {
  slides: Slide[]
  category: string
  coverImage: string | null
  photos: ReelPhotos
  settings: ReelSettings
  onChange: (next: ReelSettings) => void
}) {
  const inputProps = useMemo(
    () => ({ slides, category, coverImage, settings, photos }),
    [slides, category, coverImage, settings, photos],
  )

  // 길이는 렌더와 같은 함수를 쓴다 — 따로 구하면 미리보기와 결과가 어긋난다.
  const durationInFrames = useMemo(
    () => calcReelDurationInFrames(slides, settings),
    [slides, settings],
  )

  const picked = pickReelSlides(slides, settings)
  const seconds = (durationInFrames / FPS).toFixed(1)

  function toggleType(t: Slide["type"]) {
    const has = settings.slideTypes.includes(t)
    const next = has
      ? settings.slideTypes.filter(x => x !== t)
      : CANDIDATES.filter(c => settings.slideTypes.includes(c) || c === t)
    if (!next.length) return
    onChange({ ...settings, slideTypes: next })
  }

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <div className="shrink-0">
        <Player
          component={ReelComposition}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={FPS}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: 260, height: 462, borderRadius: 10, overflow: "hidden" }}
          controls
          loop
        />
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          {picked.length}장 · {seconds}초
        </p>
      </div>

      <div className="flex-1 space-y-4 text-xs">
        <div>
          <p className="font-semibold mb-1.5">레이아웃</p>
          <div className="flex gap-1.5">
            {([["text", "기본 (검정 배경)"], ["fullbleed", "풀블리드 (사진)"]] as const).map(([v, lbl]) => (
              <button
                key={v}
                onClick={() => onChange({ ...settings, layout: v })}
                className={`px-2.5 py-1.5 rounded-md border font-medium ${
                  settings.layout === v
                    ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {settings.layout === "fullbleed" && !Object.keys(photos).length && (
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1.5">
              사진을 못 받아왔습니다 — 단색 배경으로 렌더됩니다.
            </p>
          )}
        </div>

        <div>
          <p className="font-semibold mb-1.5">장면 선택</p>
          <div className="flex flex-wrap gap-1.5">
            {CANDIDATES.map(t => {
              const on = settings.slideTypes.includes(t)
              const exists = slides.some(s => s.type === t)
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  disabled={!exists}
                  title={exists ? undefined : "이 카드뉴스에 없는 장면입니다"}
                  className={`px-2.5 py-1.5 rounded-md border font-medium disabled:opacity-35 ${
                    on
                      ? "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {SLIDE_LABELS[t]}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            정보 나열 장면(무슨 일·키워드)은 읽는 데 시간이 걸려 릴스에서 이탈을 부릅니다.
          </p>
        </div>

        <Slider
          label="장면 길이" value={settings.slideSeconds} min={1.2} max={4} step={0.1} unit="초"
          onChange={v => onChange({ ...settings, slideSeconds: v })}
        />
        <Slider
          label="구독 장면 길이" value={settings.ctaSeconds} min={1.5} max={5} step={0.1} unit="초"
          onChange={v => onChange({ ...settings, ctaSeconds: v })}
        />
        <Slider
          label="켄번즈 줌" value={settings.kenBurns} min={0} max={0.12} step={0.005} unit="%"
          display={v => (v * 100).toFixed(1)}
          onChange={v => onChange({ ...settings, kenBurns: v })}
        />

        <button
          onClick={() => onChange({ ...DEFAULT_REEL_SETTINGS })}
          className="px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/50 font-medium"
        >
          기본값으로
        </button>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string
  display?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {display ? display(value) : value.toFixed(1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </div>
  )
}
