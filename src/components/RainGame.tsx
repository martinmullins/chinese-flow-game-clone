import { useState, useEffect, useCallback, useRef } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getDistractors, shuffle, getStreakMultiplier, getStageWords, getTotalStages } from '../data'
import HUD from './HUD'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

interface FallingWord {
  id: string
  word: VocabWord
  x: number
  y: number
  speed: number
  state: 'falling' | 'selected' | 'hit' | 'miss'
  choices: VocabWord[]
  correctIdx: number
}

const SPAWN_INTERVAL = 3000
const CHOICE_COUNT   = 4

const TIME_ATTACK_START     = 30
const TIME_ATTACK_CORRECT   = 5
const TIME_ATTACK_WRONG     = 3
const TIME_ATTACK_STAGE_BON = 15

let instanceCounter = 0

export default function RainGame({ settings, onGameOver, onMenu }: Props) {
  const isTimeAttack  = settings.gameVariant === 'time-attack'
  const isSuddenDeath = settings.gameVariant === 'sudden-death'
  const isStageMode   = settings.stageMode
  const initLives     = isSuddenDeath ? 1 : 5
  const initTime      = isTimeAttack  ? TIME_ATTACK_START : settings.gameDuration

  const [, setWords]              = useState<VocabWord[]>([])
  const [peekedChoices, setPeekedChoices] = useState<Set<number>>(new Set())
  const [falling, setFalling]     = useState<FallingWord[]>([])
  const [selected, setSelected]   = useState<FallingWord | null>(null)
  const [choiceAnim, setChoiceAnim] = useState<Record<number, 'correct' | 'wrong'>>({})

  const [score, setScore]           = useState(0)
  const [lives, setLives]           = useState(initLives)
  const [streak, setStreak]         = useState(0)
  const [correct, setCorrect]       = useState(0)
  const [wrong, setWrong]           = useState(0)
  const [totalTime, setTotalTime]   = useState(initTime)
  const [isActive, setIsActive]     = useState(false)
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([])
  const [wrongWords, setWrongWords]     = useState<VocabWord[]>([])

  // Stage mode state
  const [stage, setStage]         = useState(1)
  const [stageCleared, setStageCleared] = useState(0)
  const [stageDone, setStageDone] = useState(false)

  const poolRef           = useRef<VocabWord[]>([])
  const allRef            = useRef<VocabWord[]>([])
  const livesRef          = useRef(initLives)
  const streakRef         = useRef(0)
  const maxStreakRef      = useRef(0)
  const elapsedRef        = useRef(0)
  const doneRef           = useRef(false)
  const stageRef          = useRef(1)
  const stageClearedRef   = useRef<Set<string>>(new Set())
  const stageSizeRef      = useRef(0)
  const totalStagesRef    = useRef(0)
  const stagesCompletedRef = useRef(0)

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = getWords(settings.hskLevels)
    allRef.current = ws
    totalStagesRef.current = isStageMode ? getTotalStages(ws) : 1
    setWords(ws)
    loadStage(ws, 1)
    setIsActive(true)
  }, [])

  const loadStage = useCallback((allWords: VocabWord[], stageNum: number) => {
    const stageWords = isStageMode ? getStageWords(allWords, stageNum) : allWords
    stageSizeRef.current = stageWords.length
    stageClearedRef.current = new Set()
    setStageCleared(0)
    poolRef.current = shuffle([...stageWords])
    setFalling([])
    setSelected(null)
    setChoiceAnim({})
  }, [isStageMode])

  // ── Overall timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || stageDone) return
    const t = setTimeout(() => {
      setTotalTime(s => s - 1)
      elapsedRef.current += 1
    }, 1000)
    return () => clearTimeout(t)
  }, [isActive, totalTime, stageDone])

  useEffect(() => {
    if (totalTime <= 0 && isActive) endGame()
  }, [totalTime])

  // ── Physics tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || stageDone) return
    const TICK = 50
    const interval = setInterval(() => {
      setFalling(prev => {
        const next: FallingWord[] = []
        let missed = 0

        for (const fw of prev) {
          if (fw.state === 'hit' || fw.state === 'miss') { next.push(fw); continue }
          if (fw.state === 'selected') { next.push(fw); continue }

          const newY = fw.y + fw.speed * (TICK / 1000)
          if (newY > 100) {
            missed++
            next.push({ ...fw, state: 'miss', y: 100 })
            // In stage mode, re-queue the missed word
            if (isStageMode && !stageClearedRef.current.has(fw.word.id)) {
              poolRef.current = [...poolRef.current, fw.word]
            }
            setTimeout(() => {
              setFalling(p => p.filter(w => w.id !== fw.id))
            }, 400)
          } else {
            next.push({ ...fw, y: newY })
          }
        }

        if (missed > 0) {
          streakRef.current = 0
          setStreak(0)
          livesRef.current -= missed
          setLives(livesRef.current)
          setWrong(s => s + missed)
          if (isTimeAttack) setTotalTime(t => Math.max(t - TIME_ATTACK_WRONG * missed, 0))
          if (livesRef.current <= 0) endGame()
        }

        return next
      })
    }, TICK)

    return () => clearInterval(interval)
  }, [isActive, isTimeAttack, isStageMode, stageDone])

  // ── Spawn words ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || allRef.current.length === 0 || stageDone) return

    const spawnOne = () => {
      if (doneRef.current) return
      // In stage mode, only spawn if there are words left in pool
      if (isStageMode && poolRef.current.length === 0) return

      if (!isStageMode && poolRef.current.length === 0) {
        poolRef.current = shuffle([...allRef.current])
      }

      const word = poolRef.current[0]
      if (!word) return
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
  }, [isActive, isStageMode, stageDone])

  // ── Check stage complete (all words cleared, none falling) ──────────────
  useEffect(() => {
    if (!isStageMode || !isActive || stageDone || doneRef.current) return
    if (
      stageClearedRef.current.size >= stageSizeRef.current &&
      poolRef.current.length === 0
    ) {
      // Wait a moment for any in-flight falling words to resolve
      const t = setTimeout(() => {
        setFalling(prev => {
          const stillActive = prev.filter(fw => fw.state === 'falling' || fw.state === 'selected')
          if (stillActive.length === 0) setStageDone(true)
          return prev
        })
      }, 800)
      return () => clearTimeout(t)
    }
  }, [stageCleared, isStageMode, isActive, stageDone])

  // ── End game ─────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    setIsActive(false)
    setStageDone(false)
    setTimeout(() => {
      onGameOver({
        score,
        correct,
        wrong,
        timeUsed: elapsedRef.current,
        gameMode: 'rain',
        hskLevels: settings.hskLevels,
        correctWords,
        wrongWords,
        maxStreak: maxStreakRef.current,
        gameVariant: settings.gameVariant,
        stagesCompleted: stagesCompletedRef.current,
      })
    }, 800)
  }, [score, correct, wrong, correctWords, wrongWords])

  // ── Stage advance ────────────────────────────────────────────────────────
  const advanceStage = useCallback(() => {
    const nextStage = stageRef.current + 1
    stagesCompletedRef.current += 1

    if (nextStage > totalStagesRef.current) {
      setStageDone(false)
      endGame()
      return
    }

    stageRef.current = nextStage
    setStage(nextStage)
    setStageDone(false)
    if (isTimeAttack) setTotalTime(t => Math.min(t + TIME_ATTACK_STAGE_BON, 999))
    loadStage(allRef.current, nextStage)
  }, [endGame, isTimeAttack, loadStage])

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
      streakRef.current += 1
      setStreak(streakRef.current)
      if (streakRef.current > maxStreakRef.current) maxStreakRef.current = streakRef.current
      const points = getStreakMultiplier(streakRef.current)

      setChoiceAnim({ [idx]: 'correct' })
      setScore(s => s + points)
      setCorrect(s => s + 1)
      setCorrectWords(ws => [...ws, selected.word])
      setFalling(prev => prev.map(w => w.id === selected.id ? { ...w, state: 'hit' } : w))
      if (isTimeAttack) setTotalTime(t => Math.min(t + TIME_ATTACK_CORRECT, 999))

      if (isStageMode) {
        stageClearedRef.current.add(selected.word.id)
        const cleared = stageClearedRef.current.size
        setStageCleared(cleared)
      }

      setTimeout(() => {
        setFalling(prev => prev.filter(w => w.id !== selected.id))
        setSelected(null)
        setChoiceAnim({})
      }, 600)
    } else {
      streakRef.current = 0
      setStreak(0)

      setChoiceAnim({ [idx]: 'wrong' })
      setWrong(s => s + 1)
      setWrongWords(ws => [...ws, selected.word])
      if (isTimeAttack) setTotalTime(t => Math.max(t - TIME_ATTACK_WRONG, 0))

      // Re-queue in stage mode so the word falls again
      if (isStageMode && !stageClearedRef.current.has(selected.word.id)) {
        poolRef.current = [...poolRef.current, selected.word]
      }

      livesRef.current -= 1
      setLives(livesRef.current)
      setFalling(prev => prev.map(w => w.id === selected.id ? { ...w, state: 'falling' } : w))
      setTimeout(() => {
        setSelected(null)
        setChoiceAnim({})
        setPeekedChoices(new Set())
      }, 600)
      if (livesRef.current <= 0) endGame()
    }
  }, [selected, endGame, isTimeAttack, isStageMode])

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
        maxLives={initLives}
        timeLeft={totalTime}
        correct={correct}
        wrong={wrong}
        streak={streak}
        stageInfo={isStageMode ? { stage, total: totalStagesRef.current, done: stageCleared, size: stageSizeRef.current } : undefined}
        onMenu={onMenu}
      />

      <div className="rain-area">
        {falling.map(fw => (
          <div
            key={fw.id}
            className={['rain-word', fw.state === 'selected' ? 'selected' : '', fw.state === 'hit' ? 'hit' : '', fw.state === 'miss' ? 'miss' : ''].join(' ')}
            style={{ left: `${fw.x}%`, top: `${Math.min(fw.y, 95)}%`, transform: 'translate(-50%, 0)', cursor: fw.state === 'falling' ? 'pointer' : 'default' }}
            onClick={() => fw.state === 'falling' && handleWordClick(fw)}
          >
            {settings.matchType === 'pinyin-english' ? (
              <span className="rain-word-hanzi" style={{ fontSize: '1.1rem' }}>{fw.word.pinyin}</span>
            ) : (
              <>
                <span className="rain-word-hanzi">{fw.word.hanzi}</span>
                {showPinyin && <span className="rain-word-pinyin">{fw.word.pinyin}</span>}
              </>
            )}
          </div>
        ))}

        {falling.length === 0 && isActive && !stageDone && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            Characters incoming…
          </div>
        )}
      </div>

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
                      <span className="peek-btn" role="button" onClick={e => { e.stopPropagation(); setPeekedChoices(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n }) }}>?</span>
                    </>
                  ) : (
                    <>
                      {getRightLabel(choice)}
                      {useEmoji && isPeeked && (
                        <span className="peek-btn peek-btn-close" role="button" onClick={e => { e.stopPropagation(); setPeekedChoices(prev => { const n = new Set(prev); n.delete(i); return n }) }}>{choice.emoji}</span>
                      )}
                    </>
                  )}
                </button>
              )
            })
          : Array.from({ length: CHOICE_COUNT }, (_, i) => (
              <div key={i} className="rain-choice" style={{ opacity: 0.25 }}>—</div>
            ))
        }
      </div>

      {/* Stage Complete overlay */}
      {stageDone && !doneRef.current && (
        <div className="stage-complete-overlay">
          <div className="stage-complete-card">
            <div className="stage-complete-emoji">🎉</div>
            <h2>Stage {stage} Complete!</h2>
            <p className="stage-complete-sub">
              {stageSizeRef.current} characters cleared
              {isTimeAttack && <> · <span style={{ color: 'var(--green)' }}>+{TIME_ATTACK_STAGE_BON}s bonus</span></>}
            </p>
            <button className="stage-continue-btn" onClick={advanceStage}>
              {stageRef.current < totalStagesRef.current ? `Stage ${stage + 1} →` : 'See Results'}
            </button>
          </div>
        </div>
      )}

      {!isActive && doneRef.current && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="game-over-card">
            <h2>Game Over</h2>
            <div className="big-score">{score}</div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{correct} hit · {wrong} missed</p>
            {isStageMode && stagesCompletedRef.current > 0 && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                {stagesCompletedRef.current} stage{stagesCompletedRef.current !== 1 ? 's' : ''} completed
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
