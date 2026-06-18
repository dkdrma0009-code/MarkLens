"use client"

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import type { InsightScores } from "@/types/insight-lab"

interface Props {
  scores: InsightScores
  prevScores?: InsightScores
  size?: number
}

export default function InsightRadarChart({ scores, prevScores, size = 260 }: Props) {
  const data = [
    { subject: "관찰력", current: scores.observation, prev: prevScores?.observation },
    { subject: "분석력", current: scores.analysis, prev: prevScores?.analysis },
    { subject: "인사이트력", current: scores.insight, prev: prevScores?.insight },
    { subject: "전략력", current: scores.strategy, prev: prevScores?.strategy },
  ]

  return (
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: "#6b7280" }}
        />
        <Tooltip
          formatter={(v) => v != null ? [`${v}점`, ""] : ["", ""]}
          contentStyle={{
            background: "rgba(17,24,39,0.9)",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            color: "#f9fafb",
          }}
        />
        {prevScores && (
          <Radar
            name="이전 평균"
            dataKey="prev"
            stroke="#9ca3af"
            fill="#9ca3af"
            fillOpacity={0.15}
            strokeDasharray="4 2"
          />
        )}
        <Radar
          name="이번 점수"
          dataKey="current"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.35}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
