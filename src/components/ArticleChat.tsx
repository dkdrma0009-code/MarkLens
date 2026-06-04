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
  const [streaming, setStreaming] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streaming])

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg: Message = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setStreaming(true)

    // 스트리밍용 빈 어시스턴트 메시지 추가
    setMessages(prev => [...prev, { role: "assistant", content: "" }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: newMessages.slice(-6), // 최근 6개만
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error("응답 오류")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (data === "[DONE]") break
          try {
            const { text } = JSON.parse(data)
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = {
                role: "assistant",
                content: updated[updated.length - 1].content + text,
              }
              return updated
            })
          } catch {}
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content: "죄송해요, 잠시 문제가 있어요. 다시 시도해주세요.",
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <>
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

      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 w-80 md:w-96 flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden"
          style={{ height: "480px" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0"
            style={{ backgroundColor: color }}>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-white" />
              <span className="text-sm font-bold text-white">AI에게 물어보세요</span>
            </div>
            <button onClick={() => { setOpen(false); abortRef.current?.abort() }}
              className="text-white/80 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm"
                  }`}
                  style={m.role === "user" ? { backgroundColor: color } : {}}
                >
                  {m.content}
                  {/* 스트리밍 커서 */}
                  {streaming && i === messages.length - 1 && m.role === "assistant" && (
                    <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.content === "" && (
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

          <div className="border-t border-gray-100 p-3 flex gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="질문을 입력하세요..."
              disabled={streaming}
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-gray-400 transition-colors disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={streaming || !input.trim()}
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
