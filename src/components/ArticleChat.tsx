"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function ArticleChat({ context, color }: { context: string; color: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "이 인사이트에 대해 궁금한 게 있으면 물어보세요!" }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // 패널 열릴 때 input 자동 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // 새 메시지마다 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: "user", content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: [...messages.slice(1), userMsg],
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? `서버 오류 (${res.status})`)
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.reply || "죄송해요, 다시 시도해주세요.",
      }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: e.message || "오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      }])
    } finally {
      setLoading(false)
      // send 후 input 포커스 복원
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <>
      {/* Floating Button — 패널이 열렸을 때 숨김 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold shadow-lg hover:opacity-90 transition-all"
          style={{ backgroundColor: color }}
        >
          <MessageCircle className="w-4 h-4" />
          AI에게 물어보기
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-80 md:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ height: "480px" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">AI에게 물어보세요</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                  style={m.role === "user" ? { backgroundColor: color } : {}}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-xl text-white disabled:opacity-40 transition-opacity flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
