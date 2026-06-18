"use client"

import { useState } from "react"
import { Trophy, FileText, BookOpen, BarChart2 } from "lucide-react"
import ChallengeTab from "./ChallengeTab"
import FreeAnalysisTab from "./FreeAnalysisTab"
import NotesTab from "./NotesTab"
import ReportTab from "./ReportTab"
import type { InsightTab } from "@/types/insight-lab"

const TABS: { id: InsightTab; label: string; icon: React.ReactNode; shortLabel: string }[] = [
  { id: "challenge", label: "오늘의 챌린지", shortLabel: "챌린지", icon: <Trophy className="w-4 h-4" /> },
  { id: "free", label: "자유 분석", shortLabel: "자유", icon: <FileText className="w-4 h-4" /> },
  { id: "notes", label: "인사이트 노트", shortLabel: "노트", icon: <BookOpen className="w-4 h-4" /> },
  { id: "report", label: "성장 리포트", shortLabel: "리포트", icon: <BarChart2 className="w-4 h-4" /> },
]

export default function InsightLabTabs() {
  const [activeTab, setActiveTab] = useState<InsightTab>("challenge")

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div className="flex items-center border-b border-gray-100 dark:border-gray-800 -mx-6 px-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                : "border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {activeTab === "challenge" && <ChallengeTab />}
        {activeTab === "free" && <FreeAnalysisTab />}
        {activeTab === "notes" && <NotesTab />}
        {activeTab === "report" && <ReportTab />}
      </div>
    </div>
  )
}
