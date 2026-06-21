import { useState, useEffect, useCallback, useRef } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getDistractors, shuffle } from '../data'
import HUD from './HUD'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

interface FallingWord {
  id: string          // unique instance id
  word: VocabWord
  x: number           // percentage 5-85
  y: number           // percentage 0-100
  speed: number       // % per second
  state: 'falling' | 'selected' | 'hit' | 'miss'
  choices: VocabWord[]
  correctIdx: number
}

const SPAWN_INTERVAL = 3000  // ms between new words
const CHOICE_COUNT = 4

let instanceCounter = 0

export default function RainGame({ settings, onGameOver, onMenu }: Props) {
  const [, setWords]              = useState<VocabWord[]>([])
  const [peekedChoices, setPeekedChoices] = useState<Set<number>>(new Set())
  const [falling, setFalling]     = useState<FallingWord[]>([])
  const [selected, setSelected]   = useState<FallingWord | null>(null)
  const [choiceAnim, setChoiceAnim] = useState<Record<number, 'correct' | 'wrong'>>({})

  const [score, setScore]           = useState(0)
  const [lives, setLives]           = useState(5)
  const [correct, setCorrect]       = useState(0)
  const [wrong, setWrong]           = useState(0)
  const [totalTime, setTotalTime]   = useState(settings.gameDuration)
  const [isActive, setIsActive]     = useState(false)
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([])
  const [wrongWords, setWrongWords]     = useState<VocabWord[]>([])

  const poolRef  = useRef<VocabWord[]>([])
  const allRef   = useRef<VocabWord[]>([])
  const livesRef = useRef(5)
  const doneRef  = useRef(false)

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = getWords(settings.hskLevels)
    allRef.current = ws
    poolRef.current = shuffle([...ws])
    setWords(ws)
    setIsActive(true)
  }, [])

  // ── Overall timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return
    const t = setTimeout(() => setTotalTime(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [isActive, totalTime])

  useEffect(() => {
    if (totalTime <= 0 && isActive) endGame()
  }, [totalTime])

  // ── Physics tick (60fps approx) ──────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return
    const TICK = 50 // ms
    const interval = setInterval(() => {
      setFalling(prev => {
        const next: FallingWord[] = []
        let missed = 0

        for (const fw of prev) {
          if (fw.state === 'hit' || fw.state === 'miss') {
            next.push(fw)
            continue
          }
          if (fw.state === 'selected') {
            next.push(fw)
            continue
          }
          // falling
          const newY = fw.y + fw.speed * (TICK / 1000)
          if (newY > 100) {
            // missed!
            missed++
            next.push({ ...fw, state: 'miss', y: 100 })
            setTimeout(() => {
              setFalling(p => p.filter(w => w.id !== fw.id))
            }, 400)
          } else {
            next.push({ ...fw, y: newY })
          }
        }

        if (missed > 0) {
          livesRef.current -= missed
          setLives(livesRef.current)
          setWrong(s => s + missed)
          if (livesRef.current <= 0) endGame()
        }

        return next
      })
    }, TICK)

    return () => clearInterval(interval)
  }, [isActive])

  // ── Spawn words ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || allRef.current.length === 0) return

    const spawnOne = () => {
      if (doneRef.current) return
      if (poolRef.current.length === 0) {
        poolRef.current = shuffle([...allRef.current])
      }
      const word = poolRef.current[0]
      poolRef.current = poolRef.current.slice(1)

      const distractors = getDistractors(word, allRef.current, CHOICE_COUNT - 1)
      const choices = shuffle([word, ...distractors])
      const correctIdx = choices.findIndex(c => c.id === word.id)

      const fw: FallingWord = {
        id: `fw_${instanceCounter++}`,
        word,
        x: 5 + Math.random() * 70,
        y: 0,
        speed: 8 + Math.random() * 6,
        state: 'falling',
        choices,
        correctIdx,
      }

      setFalling(prev => [...prev.filter(f => f.state !== 'hit' && f.state !== 'miss'), fw])
    }

    spawnOne()
    const interval = setInterval(spawnOne, SPAWN_INTERVAL)
    return () => clearInterval(interval)
  }, [isActive])

  // ── End game ─────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    setIsActive(false)
    setTimeout(() => {
      onGameOver({
        score,
        correct,
        wrong,
        timeUsed: settings.gameDuration - totalTime,
        gameMode: 'rain',
        hskLevels: settings.hskLevels,
        correctWords,
        wrongWords,
      })
    }, 800)
  }, [score, correct, wrong, totalTime, correctWords, wrongWords])

  // ── Click a falling word ─────────────────────────────────────────────────
  const handleWordClick = useCallback((fw: FallingWord) => {
    if (fw.state !== 'falling') return
    setFalling(prev =>
      prev.map(w => w.id === fw.id
        ? { ...w, state: 'selected' }
        : w.state === 'selected' ? { ...w, state: 'falling' } : w
      )
    )
    setSelected(fw)
    setChoiceAnim({})
  }, [])

  // ── Choose meaning ────────────────────────────────────────────────────────
  const handleChoice = useCallback((idx: number) => {
    if (!selected) return

    if (idx === selected.correctIdx) {
      setChoiceAnim({ [idx]: 'correct' })
      setScore(s => s + 1)
      setCorrect(s => s + 1)
      setCorrectWords(ws => [...ws, selected.word])
      setFalling(prev => prev.map(w => w.id === selected.id ? { ...w, state: 'hit' } : w))
      setTimeout(() => {
        setFalling(prev => prev.filter(w => w.id !== selected.id))
        setSelected(null)
        setChoiceAnim({})
      }, 600)
    } else {
      setChoiceAnim({ [idx]: 'wrong' })
      setWrong(s => s + 1)
      setWrongWords(ws => [...ws, selected.word])
      livesRef.current -= 1
      setLives(livesRef.current)
      // Resume falling
      setFalling(prev => prev.map(w => w.id === selected.id ? { ...w, state: 'falling' } : w))
      setTimeout(() => {
        setSelected(null)
        setChoiceAnim({})
        setPeekedChoices(new Set())
      }, 600)
      if (livesRef.current <= 0) endGame()
    }
  }, [selected, endGame])

  const displayChoices = selected?.choices ?? []
  const showPinyin = settings.showPinyinHint || settings.matchType === 'hanzi-pinyin'

  const getRightLabel = (w: VocabWord) => {
    if (settings.matchType === 'hanzi-english') return w.english
    if (settings.matchType === 'hanzi-pinyin') return w.pinyin
    return w.english
  }

  return (
    <div className="rain-screen">
      <HUD
        score={score}
        lives={lives}
        timeLeft={totalTime}
        correct={correct}
        wrong={wrong}
        onMenu={onMenu}
      />

      <div className="rain-area">
        {falling.map(fw => (
          <div
            key={fw.id}
            className={[
              'rain-word',
              fw.state === 'selected' ? 'selected' : '',
              fw.state === 'hit' ? 'hit' : '',
              fw.state === 'miss' ? 'miss' : '',
            ].join(' ')}
            style={{
              left: `${fw.x}%`,
              top: `${Math.min(fw.y, 95)}%`,
              transform: 'translate(-50%, 0)',
              cursor: fw.state === 'falling' ? 'pointer' : 'default',
            }}
            onClick={() => fw.state === 'falling' && handleWordClick(fw)}
          >
            {settings.matchType === 'pinyin-english' ? (
              <span className="rain-word-hanzi" style={{ fontSize: '1.1rem' }}>
                {fw.word.pinyin}
              </span>
            ) : (
              <>
                <span className="rain-word-hanzi">{fw.word.hanzi}</span>
                {showPinyin && (
                  <span className="rain-word-pinyin">{fw.word.pinyin}</span>
                )}
              </>
            )}
          </div>
        ))}

        {falling.length === 0 && isActive && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-dim)', fontSize: '0.9rem',
          }}>
            Characters incoming…
          </div>
        )}
      </div>

      {/* Choice panel — always visible at bottom */}
      <div className="rain-choices">
        {selected
          ? displayChoices.map((choice, i) => {
              const anim = choiceAnim[i]
              const useEmoji = settings.showEmoji && !!choice.emoji && settings.matchType !== 'hanzi-pinyin'
              const isPeeked = peekedChoices.has(i)
              return (
                <button
                  key={i}
                  className={['rain-choice', anim ?? ''].join(' ')}
                  onClick={() => handleChoice(i)}
                  disabled={Object.keys(choiceAnim).length > 0}
                  style={{ position: 'relative', flexDirection: 'column', gap: 2 }}
                >
                  {useEmoji && !isPeeked ? (
                    <>
                      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{choice.emoji}</span>
                      <span
                        className="peek-btn"
                        role="button"
                        onClick={e => {
                          e.stopPropagation()
                          setPeekedChoices(prev => {
                            const next = new Set(prev)
                            if (next.has(i)) next.delete(i); else next.add(i)
                            return next
                          })
                        }}
                      >?</span>
                    </>
                  ) : (
                    <>
                      {getRightLabel(choice)}
                      {useEmoji && isPeeked && (
                        <span
                          className="peek-btn peek-btn-close"
                          role="button"
                          onClick={e => {
                            e.stopPropagation()
                            setPeekedChoices(prev => { const n = new Set(prev); n.delete(i); return n })
                          }}
                        >{choice.emoji}</span>
                      )}
                    </>
                  )}
                </button>
              )
            })
          : Array.from({ length: CHOICE_COUNT }, (_, i) => (
              <div key={i} className="rain-choice" style={{ opacity: 0.25 }}>
                —
              </div>
            ))
        }
      </div>

      {!isActive && doneRef.current && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}>
          <div className="game-over-card">
            <h2>Game Over</h2>
            <div className="big-score">{score}</div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              {correct} hit · {wrong} missed
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
