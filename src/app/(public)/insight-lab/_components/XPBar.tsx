"use client"

import { getLevel } from "@/types/insight-lab"
import { Flame, Star } from "lucide-react"

interface XPBarProps {
  xp: number
  streak: number
  totalSessions: number
}

export default function XPBar({ xp, streak, totalSessions }: XPBarProps) {
  const { level, name, progress, next, current } = getLevel(xp)

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
            Lv.{level}
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{name}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            {streak}일 연속
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            {totalSessions}회 분석
          </span>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{xp.toLocaleString()} XP</span>
          <span>다음 레벨: {next.toLocaleString()} XP</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
