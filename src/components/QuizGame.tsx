import { useState, useEffect, useCallback, useRef } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getGroupWords, shuffle } from '../data'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

const MUTE_KEY  = 'hanziliu_muted'
const STATS_KEY = 'hanziliu_stats'

// ── TTS ─────────────────────────────────────────────────────────────────────
let ttsVoice: SpeechSynthesisVoice | null = null
function loadVoice() {
  const voices = window.speechSynthesis.getVoices()
  const zh = voices.filter(v => v.lang.startsWith('zh'))
  ttsVoice =
    zh.find(v => /male/i.test(v.name)) ||
    zh.find(v => !/female/i.test(v.name)) ||
    zh[0] || null
}
if (typeof window !== 'undefined') {
  window.speechSynthesis.onvoiceschanged = loadVoice
  loadVoice()
}
function speak(hanzi: string) {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(hanzi)
  u.lang = 'zh-CN'
  u.rate = 0.85
  if (ttsVoice) u.voice = ttsVoice
  window.speechSynthesis.speak(u)
}

function saveStats(result: GameResult) {
  const raw = localStorage.getItem(STATS_KEY)
  const s = raw ? JSON.parse(raw) : { gamesPlayed: 0, wins: 0, sdLosses: 0, bestSD: 0 }
  s.gamesPlayed++
  if (result.sdCompleted) {
    s.wins++
    s.bestSD = Math.max(s.bestSD, result.sdCount)
  } else if (result.sdReached) {
    s.sdLosses++
    s.bestSD = Math.max(s.bestSD, result.sdCount)
  }
  localStorage.setItem(STATS_KEY, JSON.stringify(s))
}

// SD eligible thresholds (mirror original game)
function checkSdEligible(routineIdx: number, totalMisses: number): boolean {
  if (routineIdx === 8  && totalMisses < 2) return true
  if (routineIdx === 15 && totalMisses < 3) return true
  if (routineIdx === 30 && totalMisses < 7) return true
  return false
}

interface Question {
  target: VocabWord
  choices: VocabWord[]   // 8 items, shuffled; target is among them
  correctIdx: number
  removedIdxs: Set<number>
  missedThisQ: boolean
}

type Phase = 'normal' | 'sd-enter' | 'sd' | 'win' | 'lose'

export default function QuizGame({ settings, onGameOver, onMenu }: Props) {
  const wordsRef        = useRef<VocabWord[]>([])
  const orderRef        = useRef<number[]>([])
  const scoresRef       = useRef<number[]>([])
  const rRef            = useRef(0)
  const routineIdxRef   = useRef(0)
  const missesRef       = useRef(0)
  const startTimeRef    = useRef(Date.now())
  const sdOrderRef      = useRef<number[]>([])
  const sdCountRef      = useRef(0)
  const correctWordsRef = useRef<VocabWord[]>([])
  const wrongWordsRef   = useRef<VocabWord[]>([])

  const [phase, setPhase]       = useState<Phase>('normal')
  const [q, setQ]               = useState<Question | null>(null)
  const [chosen, setChosen]     = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [sdCount, setSdCount]   = useState(0)
  const [sdTotal, setSdTotal]   = useState(0)
  const [muted, setMuted]       = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const mutedRef                = useRef(muted)
  mutedRef.current = muted

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      localStorage.setItem(MUTE_KEY, String(next))
      if (next) window.speechSynthesis.cancel()
      return next
    })
  }, [])

  // ── Build a question for normal phase (sliding window of 8) ─────────────────
  const buildNormalQ = useCallback((): Question => {
    const words  = wordsRef.current
    const order  = orderRef.current
    const r      = rRef.current
    const N      = words.length
    const end    = Math.min(r + 8, N)
    const slice  = order.slice(r, end)
    const padded = slice.length < 8
      ? [...slice, ...order.slice(0, 8 - slice.length)]
      : slice
    const target    = words[order[r]]
    const choices   = shuffle(padded.map(idx => words[idx]))
    const correctIdx = choices.findIndex(w => w.id === target.id)
    return { target, choices, correctIdx, removedIdxs: new Set(), missedThisQ: false }
  }, [])

  const buildSdQ = useCallback((): Question => {
    const words  = wordsRef.current
    const target = words[sdOrderRef.current[sdCountRef.current]]
    const others = shuffle(words.filter(w => w.id !== target.id)).slice(0, 7)
    const choices = shuffle([target, ...others])
    const correctIdx = choices.findIndex(w => w.id === target.id)
    return { target, choices, correctIdx, removedIdxs: new Set(), missedThisQ: false }
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const levelWords = getWords(settings.hskLevels)
    const words = settings.groupIndex > 0 && settings.hskLevels.length === 1
      ? getGroupWords(levelWords, settings.groupIndex)
      : levelWords
    wordsRef.current      = words
    orderRef.current      = shuffle(words.map((_, i) => i))
    scoresRef.current     = new Array(words.length).fill(0)
    rRef.current          = 0
    routineIdxRef.current = 0
    missesRef.current     = 0
    startTimeRef.current  = Date.now()
    sdOrderRef.current    = shuffle(words.map((_, i) => i))
    sdCountRef.current    = 0
    setSdTotal(words.length)
    setQ(buildNormalQ())
  }, []) // eslint-disable-line

  // ── Enter sudden death ───────────────────────────────────────────────────────
  const enterSD = useCallback(() => {
    sdOrderRef.current = shuffle(wordsRef.current.map((_, i) => i))
    sdCountRef.current = 0
    setSdCount(0)
    setPhase('sd-enter')
    setChosen(null)
    setFeedback(null)
    setTimeout(() => {
      setPhase('sd')
      setQ(buildSdQ())
    }, 2200)
  }, [buildSdQ])

  // ── Correct in normal phase ──────────────────────────────────────────────────
  const normalCorrect = useCallback((currentQ: Question) => {
    const order  = orderRef.current
    const scores = scoresRef.current
    const words  = wordsRef.current
    const r      = rRef.current

    correctWordsRef.current = [...correctWordsRef.current, currentQ.target]

    if (currentQ.missedThisQ) {
      scores[order[r]] = 2
    } else {
      scores[order[r]]--
    }

    routineIdxRef.current++

    if (scores[order[r]] <= 0) {
      const maxR = Math.max(0, words.length - 8)
      rRef.current = Math.min(r + 1, maxR)
      if (rRef.current >= maxR && r >= maxR) {
        // All words cleared
        enterSD()
        return
      }
    }

    if (checkSdEligible(routineIdxRef.current, missesRef.current)) {
      enterSD()
      return
    }

    setTimeout(() => {
      setChosen(null)
      setFeedback(null)
      setQ(buildNormalQ())
    }, 700)
  }, [buildNormalQ, enterSD])

  // ── Correct in SD phase ──────────────────────────────────────────────────────
  const sdCorrect = useCallback((currentQ: Question) => {
    correctWordsRef.current = [...correctWordsRef.current, currentQ.target]
    sdCountRef.current++
    setSdCount(sdCountRef.current)

    if (sdCountRef.current >= wordsRef.current.length) {
      setPhase('win')
      setTimeout(() => {
        const r: GameResult = {
          hskLevels: settings.hskLevels,
          matchType: settings.matchType,
          phase1Misses: missesRef.current,
          sdCompleted: true,
          sdReached: true,
          sdCount: sdCountRef.current,
          sdTotal: wordsRef.current.length,
          correctWords: correctWordsRef.current,
          wrongWords: wrongWordsRef.current,
          timeUsed: Math.round((Date.now() - startTimeRef.current) / 1000),
        }
        saveStats(r)
        onGameOver(r)
      }, 3000)
      return
    }

    setTimeout(() => {
      setChosen(null)
      setFeedback(null)
      setQ(buildSdQ())
    }, 700)
  }, [buildSdQ, onGameOver, settings])

  // ── Option click ─────────────────────────────────────────────────────────────
  const handleChoice = useCallback((idx: number) => {
    if (chosen !== null || !q) return
    if (q.removedIdxs.has(idx)) return

    if (!mutedRef.current) speak(q.target.hanzi)
    setChosen(idx)

    if (idx === q.correctIdx) {
      setFeedback('correct')
      if (phase === 'sd') {
        sdCorrect(q)
      } else {
        normalCorrect(q)
      }
    } else {
      setFeedback('wrong')
      wrongWordsRef.current = [...wrongWordsRef.current, q.target]

      if (phase === 'sd') {
        setPhase('lose')
        setTimeout(() => {
          const r: GameResult = {
            hskLevels: settings.hskLevels,
            matchType: settings.matchType,
            phase1Misses: missesRef.current,
            sdCompleted: false,
            sdReached: true,
            sdCount: sdCountRef.current,
            sdTotal: wordsRef.current.length,
            correctWords: correctWordsRef.current,
            wrongWords: wrongWordsRef.current,
            timeUsed: Math.round((Date.now() - startTimeRef.current) / 1000),
          }
          saveStats(r)
          onGameOver(r)
        }, 3000)
      } else {
        missesRef.current++
        // Remove one random remaining wrong option (not the one just clicked)
        const removable = q.choices
          .map((_, i) => i)
          .filter(i => i !== q.correctIdx && !q.removedIdxs.has(i) && i !== idx)
        const toRemove = removable[Math.floor(Math.random() * removable.length)]
        const newRemoved = new Set(q.removedIdxs)
        if (toRemove !== undefined) newRemoved.add(toRemove)
        setQ({ ...q, removedIdxs: newRemoved, missedThisQ: true })
        setTimeout(() => {
          setChosen(null)
          setFeedback(null)
        }, 700)
      }
    }
  }, [chosen, q, phase, normalCorrect, sdCorrect, onGameOver, settings])

  if (!q) return null

  const isSd = phase === 'sd' || phase === 'sd-enter'
  const targetText = settings.matchType === 'pinyin-english' ? q.target.pinyin : q.target.hanzi
  const showPinyin = settings.showPinyinHint && settings.matchType !== 'pinyin-english'
  const optionText = (w: VocabWord) =>
    settings.matchType === 'hanzi-pinyin' ? w.pinyin : w.english

  return (
    <div className="game-screen">

      {/* ── Overlay screens ── */}
      {phase === 'sd-enter' && (
        <div className="phase-overlay">
          <div className="phase-card">
            <div className="phase-icon">💀</div>
            <h2>突然死亡</h2>
            <p>Sudden Death</p>
            <p className="phase-sub">All {sdTotal} words. One mistake ends it.</p>
          </div>
        </div>
      )}
      {phase === 'win' && (
        <div className="phase-overlay win">
          <div className="phase-card">
            <div className="phase-icon">🏆</div>
            <h2>完美！</h2>
            <p>Perfect — all {sdTotal} words<br />cleared in Sudden Death.</p>
          </div>
        </div>
      )}
      {phase === 'lose' && (
        <div className="phase-overlay lose">
          <div className="phase-card">
            <div className="phase-icon">💥</div>
            <h2>游戏结束</h2>
            <p>Game Over</p>
            <p className="phase-sub">Reached {sdCount} / {sdTotal} in Sudden Death</p>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="game-topbar">
        <button className="topbar-back" onClick={onMenu}>← Menu</button>
        <div className={`phase-badge ${isSd ? 'sd' : 'p1'}`}>
          {isSd ? '💀 Sudden Death' : 'Phase 1'}
        </div>
        <div className="topbar-right">
          {phase === 'sd' && (
            <span className="sd-remain">{sdTotal - sdCount} left</span>
          )}
          {phase === 'normal' && missesRef.current > 0 && (
            <span className="miss-count">✗ {missesRef.current}</span>
          )}
          <button className="topbar-mute" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* ── SD progress bar ── */}
      {phase === 'sd' && (
        <div className="sd-track">
          <div className="sd-fill" style={{ width: `${(sdCount / sdTotal) * 100}%` }} />
        </div>
      )}

      {/* ── Target word ── */}
      <div className="target-area">
        <div className={`target-card${feedback ? ' ' + feedback : ''}`}>
          <span className="target-word">{targetText}</span>
          {showPinyin && <span className="target-pinyin">{q.target.pinyin}</span>}
        </div>
      </div>

      {/* ── 8 options ── */}
      <div className="options-grid">
        {q.choices.map((choice, i) => {
          if (q.removedIdxs.has(i)) {
            return <div key={choice.id + '-removed'} className="option-slot removed" />
          }
          let cls = 'option-btn'
          if (chosen !== null) {
            if (i === q.correctIdx) cls += ' correct'
            else if (i === chosen)  cls += ' wrong'
          }
          return (
            <button
              key={choice.id}
              className={cls}
              onClick={() => handleChoice(i)}
              disabled={chosen !== null}
            >
              {optionText(choice)}
            </button>
          )
        })}
      </div>

      {/* ── Feedback ── */}
      <div className={`feedback-bar${feedback ? ' ' + feedback : ''}`}>
        {feedback === 'correct' && '✓  Correct'}
        {feedback === 'wrong'   && (isSd
          ? '✗  Game Over'
          : `✗  ${optionText(q.target)}`
        )}
      </div>
    </div>
  )
}
