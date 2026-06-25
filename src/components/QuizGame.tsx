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
const MAX_CD    = 5200   // countdown units (matches original)

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

function checkSdEligible(routineIdx: number, totalMisses: number): boolean {
  if (routineIdx === 8  && totalMisses < 2) return true
  if (routineIdx === 15 && totalMisses < 3) return true
  if (routineIdx === 30 && totalMisses < 7) return true
  return false
}

interface Question {
  target: VocabWord
  choices: VocabWord[]
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

  // ── Countdown timer refs ─────────────────────────────────────────────────
  const countdownRef   = useRef(MAX_CD)
  const addTimeRef     = useRef(0)         // pending time to smoothly add back
  const speedAltRef    = useRef(6)         // depletion speed (6 normal, 20 SD)
  const hintCountRef   = useRef(0)         // accumulates; triggers option removal
  const rafRef         = useRef<number>(0)
  const lastNowRef     = useRef<number>(0)
  const timerFiredRef  = useRef(false)     // prevents SD timeout re-triggering
  const loseTriggeredRef = useRef(false)   // prevents double game-over calls
  const phaseRef       = useRef<Phase>('normal')

  const [phase, setPhase]       = useState<Phase>('normal')
  const [q, setQ]               = useState<Question | null>(null)
  const [chosen, setChosen]     = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [sdCount, setSdCount]   = useState(0)
  const [sdTotal, setSdTotal]   = useState(0)
  const [cleared, setCleared]   = useState(0)
  const clearedRef              = useRef(0)
  const [timerPct, setTimerPct] = useState(100)
  const [muted, setMuted]       = useState(() => localStorage.getItem(MUTE_KEY) === 'true')
  const mutedRef                = useRef(muted)
  mutedRef.current  = muted
  phaseRef.current  = phase   // always-fresh phase for RAF

  // Callback refs updated every render so RAF sees fresh closures
  const triggerLoseRef = useRef<() => void>(() => {})
  const removeWrongRef = useRef<() => void>(() => {})

  triggerLoseRef.current = () => {
    if (loseTriggeredRef.current) return
    loseTriggeredRef.current = true
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
  }

  removeWrongRef.current = () => {
    setQ(prev => {
      if (!prev) return prev
      const removable = prev.choices
        .map((_, i) => i)
        .filter(i => i !== prev.correctIdx && !prev.removedIdxs.has(i))
      if (!removable.length) return prev
      const toRemove = removable[Math.floor(Math.random() * removable.length)]
      const newRemoved = new Set(prev.removedIdxs)
      newRemoved.add(toRemove)
      return { ...prev, removedIdxs: newRemoved }
    })
  }

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      localStorage.setItem(MUTE_KEY, String(next))
      if (next) window.speechSynthesis.cancel()
      return next
    })
  }, [])

  // ── Countdown timer RAF loop ──────────────────────────────────────────────
  useEffect(() => {
    let running = true

    const tick = (now: number) => {
      if (!running) return
      const delta = lastNowRef.current ? now - lastNowRef.current : 16
      lastNowRef.current = now

      const p = phaseRef.current
      if (p === 'normal' || p === 'sd') {
        // Smoothly drain addTime back into countdown (~6 units/ms, matching original)
        if (addTimeRef.current > 0) {
          const chunk = Math.min(addTimeRef.current, delta * 6)
          addTimeRef.current   -= chunk
          countdownRef.current  = Math.min(MAX_CD, countdownRef.current + chunk)
        }

        // Deplete: speedAlt * delta * 25 / 1000  (original formula)
        const deduct = (speedAltRef.current * delta * 25) / 1000
        countdownRef.current = Math.max(0, countdownRef.current - deduct)

        // Hint accumulator — remove a wrong option in Phase 1 every ~4s
        if (p === 'normal') {
          hintCountRef.current += Math.round(speedAltRef.current / 6)
          if (hintCountRef.current >= 240) {
            hintCountRef.current = 160
            removeWrongRef.current()
          }
        }

        setTimerPct((countdownRef.current / MAX_CD) * 100)

        if (countdownRef.current <= 0) {
          if (p === 'sd' && !timerFiredRef.current) {
            timerFiredRef.current = true
            triggerLoseRef.current()
          } else if (p === 'normal') {
            // Refill halfway; remove another wrong option as a hint
            countdownRef.current = MAX_CD * 0.4
            addTimeRef.current   = 0
            removeWrongRef.current()
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Build questions ───────────────────────────────────────────────────────
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
    const target     = words[order[r]]
    const choices    = shuffle(padded.map(idx => words[idx]))
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

  // ── Init ─────────────────────────────────────────────────────────────────
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
    clearedRef.current    = 0
    // Reset timer
    countdownRef.current  = MAX_CD
    addTimeRef.current    = 0
    speedAltRef.current   = 6
    hintCountRef.current  = 0
    timerFiredRef.current    = false
    loseTriggeredRef.current = false
    setSdTotal(words.length)
    setCleared(0)
    setTimerPct(100)
    setQ(buildNormalQ())
  }, []) // eslint-disable-line

  // ── Enter sudden death ────────────────────────────────────────────────────
  const enterSD = useCallback(() => {
    sdOrderRef.current   = shuffle(wordsRef.current.map((_, i) => i))
    sdCountRef.current   = 0
    // Reset timer with 3× faster depletion in SD (matching original speedAlt=20)
    countdownRef.current    = MAX_CD
    addTimeRef.current      = 0
    speedAltRef.current     = 20
    hintCountRef.current    = 0
    timerFiredRef.current   = false
    loseTriggeredRef.current = false
    setSdCount(0)
    setPhase('sd-enter')
    setChosen(null)
    setFeedback(null)
    setTimeout(() => {
      setPhase('sd')
      setQ(buildSdQ())
    }, 2200)
  }, [buildSdQ])

  // ── Correct in normal phase ───────────────────────────────────────────────
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
    addTimeRef.current += 2000   // +2s on correct (matching original addTime)

    if (scores[order[r]] <= 0) {
      clearedRef.current++
      setCleared(clearedRef.current)
      const maxR = Math.max(0, words.length - 8)
      rRef.current = Math.min(r + 1, maxR)
      if (rRef.current >= maxR && r >= maxR) {
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

  // ── Correct in SD phase ───────────────────────────────────────────────────
  const sdCorrect = useCallback((currentQ: Question) => {
    correctWordsRef.current = [...correctWordsRef.current, currentQ.target]
    sdCountRef.current++
    setSdCount(sdCountRef.current)
    addTimeRef.current += 2000   // +2s on correct

    if (sdCountRef.current >= wordsRef.current.length) {
      loseTriggeredRef.current = true  // prevent timer from stealing the win
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

  // ── Option click ──────────────────────────────────────────────────────────
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
        loseTriggeredRef.current = true  // prevent timer double-trigger
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

  const isSd      = phase === 'sd' || phase === 'sd-enter'
  const targetText = settings.matchType === 'pinyin-english' ? q.target.pinyin : q.target.hanzi
  const showPinyin = settings.showPinyinHint && settings.matchType !== 'pinyin-english'
  const optionText = (w: VocabWord) =>
    settings.matchType === 'hanzi-pinyin' ? w.pinyin : w.english

  // Timer bar color: blue → gold → red as it depletes; always red in SD
  const timerColor = isSd
    ? 'var(--red)'
    : timerPct > 50
      ? 'var(--blue)'
      : timerPct > 25
        ? 'var(--gold)'
        : 'var(--red)'

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
          {phase === 'normal' && (
            <span className="cleared-count">{cleared} / {sdTotal}</span>
          )}
          {phase === 'normal' && missesRef.current > 0 && (
            <span className="miss-count">✗ {missesRef.current}</span>
          )}
          <button className="topbar-mute" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* ── Countdown timer bar ── */}
      {(phase === 'normal' || phase === 'sd') && (
        <div className="timer-track">
          <div
            className="timer-fill"
            style={{ width: `${timerPct}%`, background: timerColor }}
          />
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
      <div className={`options-grid${settings.matchType === 'hanzi-english' ? ' two-line' : ''}`}>
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
              {settings.matchType === 'hanzi-english' ? (
                <>
                  <span className="opt-pinyin">{choice.pinyin}</span>
                  <span className="opt-english">{choice.english}</span>
                </>
              ) : optionText(choice)}
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
