import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getLeftContent, getRightContent, shuffle, getStreakMultiplier, getStageWords, getTotalStages } from '../data'
import HUD from './HUD'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

type FlashState = 'match' | 'wrong' | null

const TIME_ATTACK_START     = 30
const TIME_ATTACK_CORRECT   = 5
const TIME_ATTACK_WRONG     = 3
const TIME_ATTACK_STAGE_BON = 15

export default function FlowGame({ settings, onGameOver, onMenu }: Props) {
  const GRID = settings.gridSize
  const isTimeAttack  = settings.gameVariant === 'time-attack'
  const isSuddenDeath = settings.gameVariant === 'sudden-death'
  const isStageMode   = settings.stageMode
  const initLives     = isSuddenDeath ? 1 : 3
  const initTime      = isTimeAttack  ? TIME_ATTACK_START : settings.gameDuration

  const [leftIds, setLeftIds]   = useState<string[]>([])
  const [rightIds, setRightIds] = useState<string[]>([])

  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [flashMap, setFlashMap]         = useState<Record<string, FlashState>>({})
  const [enterSet, setEnterSet]         = useState<Set<string>>(new Set())
  const [peekedIds, setPeekedIds]       = useState<Set<string>>(new Set())

  const [score, setScore]           = useState(0)
  const [lives, setLives]           = useState(initLives)
  const [streak, setStreak]         = useState(0)
  const [correct, setCorrect]       = useState(0)
  const [wrong, setWrong]           = useState(0)
  const [timeLeft, setTimeLeft]     = useState(initTime)
  const [isActive, setIsActive]     = useState(false)
  const [gameOver, setGameOver]     = useState(false)
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([])
  const [wrongWords, setWrongWords]     = useState<VocabWord[]>([])

  // Stage mode state
  const [stage, setStage]               = useState(1)
  const [stageMatchedCount, setStageMatchedCount] = useState(0)
  const [stageDone, setStageDone]       = useState(false)

  const queueRef      = useRef<VocabWord[]>([])
  const wordMapRef    = useRef<Map<string, VocabWord>>(new Map())
  const livesRef      = useRef(initLives)
  const streakRef     = useRef(0)
  const maxStreakRef  = useRef(0)
  const elapsedRef    = useRef(0)
  const gameOverRef   = useRef(false)
  const stageRef      = useRef(1)
  const stageMatchedRef   = useRef(0)
  const stageSizeRef      = useRef(0)
  const totalStagesRef    = useRef(0)
  const stagesCompletedRef = useRef(0)
  const allWordsRef   = useRef<VocabWord[]>([])

  const wordMap = useMemo(() => wordMapRef.current, [])

  const loadStage = useCallback((allWords: VocabWord[], stageNum: number) => {
    const words = isStageMode ? getStageWords(allWords, stageNum) : allWords
    stageSizeRef.current = words.length
    stageMatchedRef.current = 0
    setStageMatchedCount(0)

    const shuffled = shuffle(words)
    const initial  = shuffled.slice(0, GRID)
    queueRef.current = shuffled.slice(GRID)

    const initialIds = initial.map(w => w.id)
    setLeftIds(initialIds)
    setRightIds(shuffle([...initialIds]))
  }, [isStageMode, GRID])

  // ── Initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    const words = getWords(settings.hskLevels)
    if (words.length < GRID) return

    allWordsRef.current = words
    wordMapRef.current  = new Map(words.map(w => [w.id, w]))
    totalStagesRef.current = isStageMode ? getTotalStages(words) : 1

    loadStage(words, 1)
    setIsActive(true)
  }, [])

  // ── Timer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || gameOver || stageDone) return
    if (timeLeft <= 0) { endGame(); return }

    const t = setTimeout(() => {
      setTimeLeft(s => s - 1)
      elapsedRef.current += 1
    }, 1000)
    return () => clearTimeout(t)
  }, [isActive, timeLeft, gameOver, stageDone])

  // ── End game ────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (gameOverRef.current) return
    gameOverRef.current = true
    setGameOver(true)
    setIsActive(false)
  }, [])

  useEffect(() => {
    if (!gameOver) return
    const timer = setTimeout(() => {
      onGameOver({
        score,
        correct,
        wrong,
        timeUsed: elapsedRef.current,
        gameMode: 'flow',
        hskLevels: settings.hskLevels,
        correctWords,
        wrongWords,
        maxStreak: maxStreakRef.current,
        gameVariant: settings.gameVariant,
        stagesCompleted: stagesCompletedRef.current,
      })
    }, 1200)
    return () => clearTimeout(timer)
  }, [gameOver])

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
    if (isTimeAttack) setTimeLeft(t => Math.min(t + TIME_ATTACK_STAGE_BON, 999))

    loadStage(allWordsRef.current, nextStage)
  }, [endGame, isTimeAttack, loadStage])

  // ── Replace matched word ─────────────────────────────────────────────────
  const replaceWord = useCallback((matchedId: string) => {
    const next = queueRef.current[0]
    queueRef.current = queueRef.current.slice(1)

    setPeekedIds(prev => { const s = new Set(prev); s.delete(matchedId); return s })

    stageMatchedRef.current += 1
    setStageMatchedCount(stageMatchedRef.current)

    if (next) {
      setEnterSet(prev => new Set(prev).add(next.id))
      setTimeout(() => {
        setEnterSet(prev => { const s = new Set(prev); s.delete(next.id); return s })
      }, 350)

      setLeftIds(prev => [...prev.filter(id => id !== matchedId), next.id])
      setRightIds(prev => {
        const filtered = prev.filter(id => id !== matchedId)
        const pos = Math.floor(Math.random() * (filtered.length + 1))
        return [...filtered.slice(0, pos), next.id, ...filtered.slice(pos)]
      })
    } else {
      setLeftIds(prev => prev.filter(id => id !== matchedId))
      setRightIds(prev => prev.filter(id => id !== matchedId))
    }

    // Check stage completion after state updates settle
    if (isStageMode) {
      const matched = stageMatchedRef.current
      const size    = stageSizeRef.current
      const nextId  = next?.id
      // Stage done when all words cleared and no more queued
      if (matched >= size && !nextId) {
        setTimeout(() => setStageDone(true), 600)
      }
    }
  }, [isStageMode])

  // ── Click handlers ──────────────────────────────────────────────────────
  const handleLeftClick = useCallback((wordId: string) => {
    if (!isActive || gameOverRef.current || stageDone) return
    if (flashMap[wordId]) return
    setSelectedLeft(prev => prev === wordId ? null : wordId)
  }, [isActive, flashMap, stageDone])

  const handleRightClick = useCallback((wordId: string) => {
    if (!isActive || gameOverRef.current || !selectedLeft || stageDone) return
    if (flashMap[wordId] || flashMap[selectedLeft]) return

    const left = selectedLeft
    setSelectedLeft(null)

    if (wordId === left) {
      // ── MATCH ──
      const word = wordMapRef.current.get(wordId)!
      streakRef.current += 1
      setStreak(streakRef.current)
      if (streakRef.current > maxStreakRef.current) maxStreakRef.current = streakRef.current
      const points = getStreakMultiplier(streakRef.current)

      setFlashMap(prev => ({ ...prev, [wordId]: 'match' }))
      setScore(s => s + points)
      setCorrect(s => s + 1)
      setCorrectWords(ws => [...ws, word])
      if (isTimeAttack) setTimeLeft(t => Math.min(t + TIME_ATTACK_CORRECT, 999))

      setTimeout(() => {
        setFlashMap(prev => { const n = { ...prev }; delete n[wordId]; return n })
        replaceWord(wordId)
      }, 520)
    } else {
      // ── WRONG ──
      const word = wordMapRef.current.get(left)!
      streakRef.current = 0
      setStreak(0)

      setFlashMap(prev => ({ ...prev, [left]: 'wrong', [wordId]: 'wrong' }))
      setWrong(s => s + 1)
      setWrongWords(ws => [...ws, word])
      if (isTimeAttack) setTimeLeft(t => Math.max(t - TIME_ATTACK_WRONG, 0))

      setTimeout(() => {
        setFlashMap(prev => {
          const n = { ...prev }; delete n[left]; delete n[wordId]; return n
        })
        livesRef.current -= 1
        setLives(livesRef.current)
        if (livesRef.current <= 0) endGame()
      }, 620)
    }
  }, [isActive, selectedLeft, flashMap, replaceWord, endGame, isTimeAttack, stageDone])

  // ── Peek handler ────────────────────────────────────────────────────────
  const handlePeek = useCallback((wordId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPeekedIds(prev => {
      const next = new Set(prev)
      if (next.has(wordId)) next.delete(wordId); else next.add(wordId)
      return next
    })
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  const leftCards  = leftIds.map(id => wordMap.get(id)).filter(Boolean) as VocabWord[]
  const rightCards = rightIds.map(id => wordMap.get(id)).filter(Boolean) as VocabWord[]

  const getLeftLabel = () => settings.matchType === 'pinyin-english' ? 'Pinyin' : '汉字'
  const getRightLabel = () => {
    if (settings.matchType === 'hanzi-pinyin') return 'Pinyin'
    if (settings.showEmoji) return 'Emoji  (click ? to peek)'
    return 'English'
  }

  return (
    <div className="flow-screen">
      <HUD
        score={score}
        lives={lives}
        maxLives={initLives}
        timeLeft={timeLeft}
        correct={correct}
        wrong={wrong}
        streak={streak}
        stageInfo={isStageMode ? { stage, total: totalStagesRef.current, done: stageMatchedCount, size: stageSizeRef.current } : undefined}
        onMenu={onMenu}
      />

      <div className="flow-board">
        <div className="flow-col">
          <div className="flow-col-label">{getLeftLabel()}</div>
          {leftCards.map(word => {
            const flash = flashMap[word.id] ?? null
            const isSelected = selectedLeft === word.id
            const isEntering = enterSet.has(word.id)
            return (
              <button
                key={word.id}
                className={['vocab-card', isSelected ? 'card-selected' : '', flash === 'match' ? 'card-match' : '', flash === 'wrong' ? 'card-wrong' : '', isEntering ? 'card-enter' : ''].join(' ')}
                onClick={() => handleLeftClick(word.id)}
                disabled={!!flash}
              >
                <span className="card-hsk-badge">HSK{word.hskLevel}</span>
                <span className="card-hanzi">{getLeftContent(word, settings.matchType)}</span>
                {settings.showPinyinHint && settings.matchType !== 'pinyin-english' && (
                  <span className="card-pinyin">{word.pinyin}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="flow-divider" />

        <div className="flow-col">
          <div className="flow-col-label">{getRightLabel()}</div>
          {rightCards.map(word => {
            const flash      = flashMap[word.id] ?? null
            const isEntering = enterSet.has(word.id)
            const useEmoji   = settings.showEmoji && !!word.emoji && settings.matchType !== 'hanzi-pinyin'
            const isPeeked   = peekedIds.has(word.id)
            return (
              <button
                key={word.id}
                className={['vocab-card', useEmoji ? 'card-emoji-mode' : '', flash === 'match' ? 'card-match' : '', flash === 'wrong' ? 'card-wrong' : '', isEntering ? 'card-enter' : ''].join(' ')}
                onClick={() => handleRightClick(word.id)}
                disabled={!!flash || !selectedLeft}
                style={!selectedLeft ? { opacity: 0.72 } : undefined}
              >
                {useEmoji && !isPeeked ? (
                  <>
                    <span className="card-emoji-display">{word.emoji}</span>
                    <span className="peek-btn" role="button" onClick={e => handlePeek(word.id, e)} title="Peek at translation">?</span>
                  </>
                ) : (
                  <>
                    <span className="card-english">{getRightContent(word, settings.matchType)}</span>
                    {useEmoji && isPeeked && (
                      <span className="peek-btn peek-btn-close" role="button" onClick={e => handlePeek(word.id, e)} title="Hide translation">{word.emoji}</span>
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Stage Complete overlay */}
      {stageDone && !gameOver && (
        <div className="stage-complete-overlay">
          <div className="stage-complete-card">
            <div className="stage-complete-emoji">🎉</div>
            <h2>Stage {stage} Complete!</h2>
            <p className="stage-complete-sub">
              {stageSizeRef.current} words cleared
              {isTimeAttack && <> · <span style={{ color: 'var(--green)' }}>+{TIME_ATTACK_STAGE_BON}s bonus</span></>}
            </p>
            <button className="stage-continue-btn" onClick={advanceStage}>
              {stageRef.current < totalStagesRef.current ? `Stage ${stage + 1} →` : 'See Results'}
            </button>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="game-over-overlay">
          <div className="game-over-card">
            <h2>Time's Up!</h2>
            <div className="big-score">{score}</div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              {correct} correct · {wrong} wrong
            </p>
            {isStageMode && stagesCompletedRef.current > 0 && (
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                {stagesCompletedRef.current} stage{stagesCompletedRef.current !== 1 ? 's' : ''} completed
              </p>
            )}
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Saving results…</p>
          </div>
        </div>
      )}
    </div>
  )
}
