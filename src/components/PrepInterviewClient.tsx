"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import InterviewSession from "@/components/InterviewSession"

interface Question {
  question: string
  kind: "trend" | "role" | "behavioral"
}

type Step = "form" | "interview"

export default function PrepInterviewClient() {
  const [step, setStep] = useState<Step>("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [companyName, setCompanyName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [jd, setJd] = useState("")
  const [coverLetter, setCoverLetter] = useState("")
  const [portfolio, setPortfolio] = useState("")
  const [count, setCount] = useState(5)

  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionKey, setSessionKey] = useState(0)  // 증가시키면 InterviewSession 재마운트

  async function fetchQuestions(): Promise<Question[]> {
    const res = await fetch("/api/interview/custom-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, jobTitle, jd, coverLetter, portfolio, count }),
    })
    const data = await res.json()
    if (!data.questions?.length) throw new Error(data.error ?? "질문 생성 실패")
    return data.questions as Question[]
  }

  async function generate() {
    if (!coverLetter.trim() && !jd.trim()) {
      setError("자기소개서 또는 채용공고를 입력해주세요.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const qs = await fetchQuestions()
      setQuestions(qs)
      setSessionKey(k => k + 1)
      setStep("interview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "질문 생성에 실패했어요. 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  // InterviewSession의 "새 질문으로 다시" 버튼이 호출 — 새 질문만 반환, 컴포넌트 재마운트 안 함
  const handleRetry = useCallback(async (): Promise<Question[]> => {
    return await fetchQuestions()
  // fetchQuestions는 클로저로 최신 form state를 참조하므로 deps 포함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, jobTitle, jd, coverLetter, portfolio, count])

  // InterviewSession의 "정보 다시 입력" 버튼이 호출
  function handleGoBack() {
    setStep("form")
  }

  // 자소서 + 포트폴리오를 피드백 API에 넘겨 model_answer 맥락화 (600자 한도는 서버 측)
  const feedbackContext = [
    jobTitle && `직무: ${jobTitle}`,
    companyName && `기업: ${companyName}`,
    portfolio.trim() && `포트폴리오 핵심: ${portfolio.trim().slice(0, 150)}`,
    coverLetter.trim() && `자기소개서: ${coverLetter.trim().slice(0, 350)}`,
  ].filter(Boolean).join("\n")

  if (step === "interview") {
    return (
      <div>
        <div className="mb-8 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            {companyName && <span className="font-bold">{companyName}</span>}
            {companyName && jobTitle && " · "}
            {jobTitle && <span>{jobTitle}</span>}
            {(companyName || jobTitle) && " "}맞춤 질문 <span className="font-bold">{questions.length}개</span> 준비됐어요
          </p>
          <button
            onClick={handleGoBack}
            className="text-xs text-emerald-600 dark:text-emerald-400 underline underline-offset-2 whitespace-nowrap ml-3"
          >
            정보 수정
          </button>
        </div>
        <InterviewSession
          key={sessionKey}
          externalQuestions={questions}
          externalRole={jobTitle || "마케팅"}
          externalCompanyName={companyName}
          feedbackContext={feedbackContext}
          onGoBack={handleGoBack}
          onRetry={handleRetry}
        />
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            기업명
          </label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="예: S&A엔터테인먼트"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            지원 직무
          </label>
          <input
            type="text"
            value={jobTitle}
            onChange={e => setJobTitle(e.target.value)}
            placeholder="예: 크리에이터 마케팅 인턴"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          채용공고 / JD <span className="font-normal text-gray-400">(선택)</span>
        </label>
        <textarea
          value={jd}
          onChange={e => setJd(e.target.value)}
          placeholder="채용공고 내용을 붙여넣어 주세요. 자격요건, 우대사항, 담당업무 등..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          자기소개서 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={coverLetter}
          onChange={e => setCoverLetter(e.target.value)}
          placeholder="자기소개서 전문 또는 주요 항목 내용을 붙여넣어 주세요."
          rows={7}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
        <p className="text-xs text-gray-400 mt-1">자기소개서에 언급한 구체적인 경험을 파고드는 질문 + 모범답안 맥락화에 활용돼요.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
          포트폴리오 요약 <span className="font-normal text-gray-400">(선택)</span>
        </label>
        <textarea
          value={portfolio}
          onChange={e => setPortfolio(e.target.value)}
          placeholder="주요 프로젝트 성과, 수치, 역할 등 핵심 내용만 간략히 정리해서 붙여넣어 주세요."
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">질문 수</p>
        <div className="flex gap-3">
          {[3, 5, 7].map(n => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                count === n
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {n}문항 (~{n * 3}분)
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={generate}
        disabled={loading}
        className="w-full py-4 rounded-2xl bg-black dark:bg-white text-white dark:text-black text-base font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>맞춤 질문 생성 중...</span>
          </>
        ) : (
          "맞춤 면접 질문 생성하기"
        )}
      </button>

      {loading && (
        <p className="text-center text-sm text-gray-400">
          자기소개서와 채용공고를 분석 중이에요. 10~30초 정도 걸려요.
        </p>
      )}
    </div>
  )
}
