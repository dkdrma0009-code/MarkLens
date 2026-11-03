// Interview voice lifecycle: speech input (Web Speech API) and the interviewer reading the question (speech synthesis).
// Both keep a generation number. Stopping, replacing or cancelling a run bumps it, and every event that arrives later
// from the old recognizer or utterance is ignored. So a late result cannot write into the next answer, a stopped
// recognizer cannot restart the microphone, and a cancelled reading cannot start listening after the interview moved on.
// Plain functions over refs, not React state: callbacks read the live values, never the ones of an old render.

export interface RecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error?: string }) => void) | null
  start: () => void
  stop: () => void
  abort?: () => void
}

export interface SpeechInputOptions {
  /** A new recognizer, or null when the browser has none. */
  create: () => RecognitionLike | null
  /** The answer so far: new speech is appended to it. */
  baseText: () => string
  onText: (text: string) => void
  onListening: (listening: boolean) => void
  /** Permission refused, no microphone, no service: listening stops for good and the caller opens typing. */
  onFatal: (message: string) => void
  /** Keep listening through silences (video mode). */
  autoRestart: () => boolean
  classifyError: (code: string) => { fatal: boolean; message: string }
  schedule?: (fn: () => void, ms: number) => unknown
}

export interface SpeechInput {
  start: () => void
  stop: () => void
  readonly listening: boolean
}

export function createSpeechInput(o: SpeechInputOptions): SpeechInput {
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  let gen = 0
  let rec: RecognitionLike | null = null
  let listening = false
  let fatal = false
  // A stopped recognizer that has not ended yet, and the generation that asked to start once it has.
  let ending: RecognitionLike | null = null
  let startWhenEnded = -1

  function setListening(on: boolean) {
    if (listening === on) return
    listening = on
    o.onListening(on)
  }

  function start() {
    if (listening || fatal) return
    // Chrome runs one recognition at a time: start after the stopped one has ended, not on a guessed delay.
    if (ending) { startWhenEnded = gen; return }
    const r = o.create()
    if (!r) return
    const mine = ++gen
    r.lang = "ko-KR"
    r.continuous = true
    r.interimResults = true
    let base = o.baseText()
    r.onresult = e => {
      if (mine !== gen) return
      let interim = "", final = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) final += t
        else interim += t
      }
      if (final) base = (base + " " + final).trim()
      o.onText((base + " " + interim).trim())
    }
    r.onerror = e => {
      if (mine !== gen) return
      const { fatal: isFatal, message } = o.classifyError(e?.error ?? "")
      // A fatal error must stop the automatic restart: it would loop forever (onerror → onend → start).
      if (isFatal) { fatal = true; o.onFatal(message) }
    }
    r.onend = () => {
      if (r === ending) {
        ending = null
        if (startWhenEnded === gen) { startWhenEnded = -1; start() }
        return
      }
      if (mine !== gen) return
      rec = null
      setListening(false)
      // Silence ended the recognition while the answer is still being given: listen again. 250 ms lets the browser
      // release the previous session; a stop or a new start in between bumps gen and cancels this.
      if (!fatal && o.autoRestart()) schedule(() => { if (mine === gen) start() }, 250)
    }
    rec = r
    try { r.start(); setListening(true) } catch { rec = null }
  }

  function stop() {
    gen++ // whatever this recognizer still sends is ignored
    const r = rec
    rec = null
    if (r && listening) {
      ending = r
      try { (r.abort ?? r.stop).call(r) } catch { ending = null }
    }
    setListening(false)
  }

  return { start, stop, get listening() { return listening } }
}

export interface UtteranceLike {
  onend: (() => void) | null
  onerror: (() => void) | null
}

export interface SynthLike {
  speak: (u: UtteranceLike) => void
  cancel: () => void
}

/** How long a question may take to be read before the reading is given up. Fallback questions are 32–107 characters
 *  (2026-11 measurement); Korean speech synthesis at rate 1.02 reads about 6–7 characters a second. 200 ms per
 *  character (5 a second) plus 4 s for the voice to load or a network voice to start leaves at least ~1.3× headroom
 *  over a normal reading: 32 chars → 10.4 s, 107 → 25.4 s. Capped at 45 s; the user can skip the reading at any time. */
export const readingTimeoutMs = (text: string) => Math.min(45_000, 4_000 + text.length * 200)

export interface QuestionReaderOptions {
  synth: () => SynthLike | null
  utterance: (text: string) => UtteranceLike
  onReading: (reading: boolean) => void
  /** Neither end nor error arrived in time (browser bug, voice never started). */
  onTimeout: () => void
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (id: unknown) => void
}

export interface QuestionReader {
  /** Read the text; onEnd runs once when the reading ends, fails, times out or is skipped — never after cancel(). */
  read: (text: string, onEnd?: () => void) => void
  /** Stop reading and go on as if it had ended (onEnd runs). */
  skip: () => void
  /** Stop reading; onEnd does not run (the interview has moved on). */
  cancel: () => void
}

export function createQuestionReader(o: QuestionReaderOptions): QuestionReader {
  const setTimer = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = o.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>))
  let gen = 0
  let timer: unknown = null
  // The reading in progress. It also keeps the utterance referenced: Chrome may drop the events of one that has been
  // garbage-collected.
  let current: { finish: (how: "end" | "timeout" | "skip") => void; utterance: UtteranceLike | null } | null = null

  function silence() {
    if (timer !== null) { clearTimer(timer); timer = null }
    try { o.synth()?.cancel() } catch { /* nothing is being read */ }
  }

  function read(text: string, onEnd?: () => void) {
    const mine = ++gen // the previous reading's events (including the error from the cancel below) are ignored
    let done = false
    const finish = (how: "end" | "timeout" | "skip") => {
      if (done || mine !== gen) return
      done = true
      current = null
      if (how === "end") { if (timer !== null) { clearTimer(timer); timer = null } }
      else silence()
      o.onReading(false)
      if (how === "timeout") o.onTimeout()
      onEnd?.()
    }
    silence()
    current = { finish, utterance: null }
    o.onReading(true)
    try {
      const synth = o.synth()
      if (!synth) throw new Error("no speech synthesis")
      const u = o.utterance(text)
      u.onend = () => finish("end")
      u.onerror = () => finish("end")
      current.utterance = u
      synth.speak(u)
      timer = setTimer(() => finish("timeout"), readingTimeoutMs(text))
    } catch { finish("end") }
  }

  function cancel() {
    gen++
    current = null
    silence()
    o.onReading(false)
  }

  return { read, skip: () => current?.finish("skip"), cancel }
}
