import { useState, useEffect, useCallback, useRef } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getRightContent, shuffle, getDistractors, getStreakMultiplier } from '../data'
import HUD from './HUD'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

const QUESTION_TIME = 10

const TIME_ATTACK_START   = 30
const TIME_ATTACK_CORRECT = 5
const TIME_ATTACK_WRONG   = 3

interface Question {
  word: VocabWord
  choices: VocabWord[]
  correctIdx: number
}

export default function QuizGame({ settings, onGameOver, onMenu }: Props) {
  const isTimeAttack  = settings.gameVariant === 'time-attack'
  const isSuddenDeath = settings.gameVariant === 'sudden-death'
  const initLives     = isSuddenDeath ? 1 : Infinity
  const initTime      = isTimeAttack  ? TIME_ATTACK_START : settings.gameDuration

  const [, setPool]               = useState<VocabWord[]>([])
  const [peekedChoices, setPeekedChoices] = useState<Set<number>>(new Set())
  const [question, setQuestion]   = useState<Question | null>(null)
  const [qTime, setQTime]         = useState(QUESTION_TIME)
  const [chosen, setChosen]       = useState<number | null>(null)
  const [feedback, setFeedback]   = useState<'correct' | 'wrong' | null>(null)

  const [score, setScore]           = useState(0)
  const [lives, setLives]           = useState(initLives)
  const [streak, setStreak]         = useState(0)
  const [correct, setCorrect]       = useState(0)
  const [wrong, setWrong]           = useState(0)
  const [totalTime, setTotalTime]   = useState(initTime)
  const [isActive, setIsActive]     = useState(false)
  const [gameOver, setGameOver]     = useState(false)
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([])
  const [wrongWords, setWrongWords]     = useState<VocabWord[]>([])

  const poolRef       = useRef<VocabWord[]>([])
  const allWordsRef   = useRef<VocabWord[]>([])
  const livesRef      = useRef(initLives)
  const streakRef     = useRef(0)
  const maxStreakRef  = useRef(0)
  const elapsedRef    = useRef(0)
  const transitioning = useRef(false)
  const gameOverRef   = useRef(false)

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const words = getWords(settings.hskLevels)
    allWordsRef.current = words
    poolRef.current = shuffle([...words])
    setPool(words)
    nextQuestion(words)
    setIsActive(true)
  }, [])

  // ── Overall timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || totalTime <= 0) return
    const t = setTimeout(() => {
      setTotalTime(s => s - 1)
      elapsedRef.current += 1
    }, 1000)
    return () => clearTimeout(t)
  }, [isActive, totalTime])

  // ── End game ─────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (gameOverRef.current) return
    gameOverRef.current = true
    setIsActive(false)
    setGameOver(true)
  }, [])

  useEffect(() => {
    if (totalTime <= 0 && isActive) endGame()
  }, [totalTime])

  useEffect(() => {
    if (!gameOver) return
    const t = setTimeout(() => {
      onGameOver({
        score,
        correct,
        wrong,
        timeUsed: elapsedRef.current,
        gameMode: 'quiz',
        hskLevels: settings.hskLevels,
        correctWords,
        wrongWords,
        maxStreak: maxStreakRef.current,
        gameVariant: settings.gameVariant,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [gameOver])

  // ── Per-question timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || chosen !== null || !question) return
    if (qTime <= 0) { handleTimeout(); return }
    const t = setTimeout(() => setQTime(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [isActive, qTime, chosen, question])

  // ── Next question ────────────────────────────────────────────────────────
  const nextQuestion = useCallback((words: VocabWord[]) => {
    if (words.length === 0) return

    if (poolRef.current.length === 0) {
      poolRef.current = shuffle([...allWordsRef.current])
    }

    const word = poolRef.current[0]
    poolRef.current = poolRef.current.slice(1)

    const distractors = getDistractors(word, words, 3)
    const allChoices  = shuffle([word, ...distractors])
    const correctIdx  = allChoices.findIndex(c => c.id === word.id)

    setQuestion({ word, choices: allChoices, correctIdx })
    setQTime(QUESTION_TIME)
    setChosen(null)
    setFeedback(null)
    setPeekedChoices(new Set())
    transitioning.current = false
  }, [])

  const advance = useCallback(() => {
    if (transitioning.current) return
    transitioning.current = true
    setTimeout(() => nextQuestion(allWordsRef.current), 1000)
  }, [nextQuestion])

  const handleChoice = useCallback((idx: number) => {
    if (chosen !== null || !question || transitioning.current || gameOverRef.current) return
    setChosen(idx)

    if (idx === question.correctIdx) {
      streakRef.current += 1
      setStreak(streakRef.current)
      if (streakRef.current > maxStreakRef.current) maxStreakRef.current = streakRef.current
      const points = getStreakMultiplier(streakRef.current)

      setFeedback('correct')
      setScore(s => s + points)
      setCorrect(s => s + 1)
      setCorrectWords(ws => [...ws, question.word])
      if (isTimeAttack) setTotalTime(t => Math.min(t + TIME_ATTACK_CORRECT, 999))
      advance()
    } else {
      streakRef.current = 0
      setStreak(0)

      setFeedback('wrong')
      setWrong(s => s + 1)
      setWrongWords(ws => [...ws, question.word])
      if (isTimeAttack) setTotalTime(t => Math.max(t - TIME_ATTACK_WRONG, 0))

      if (isSuddenDeath) {
        livesRef.current -= 1
        setLives(livesRef.current)
        if (livesRef.current <= 0) { endGame(); return }
      }
      advance()
    }
  }, [chosen, question, advance, endGame, isTimeAttack, isSuddenDeath])

  const handleTimeout = useCallback(() => {
    if (chosen !== null || !question || transitioning.current || gameOverRef.current) return
    setChosen(-1)
    setFeedback('wrong')
    streakRef.current = 0
    setStreak(0)
    setWrong(s => s + 1)
    if (question) setWrongWords(ws => [...ws, question.word])
    if (isTimeAttack) setTotalTime(t => Math.max(t - TIME_ATTACK_WRONG, 0))

    if (isSuddenDeath) {
      livesRef.current -= 1
      setLives(livesRef.current)
      if (livesRef.current <= 0) { endGame(); return }
    }
    advance()
  }, [chosen, question, advance, endGame, isTimeAttack, isSuddenDeath])

  if (!question) return null

  const timeRatio = qTime / QUESTION_TIME
  const showPinyin = settings.showPinyinHint || settings.matchType === 'hanzi-pinyin'
  const hudMaxLives = isSuddenDeath ? 1 : 0

  return (
    <div className="quiz-screen">
      <HUD
        score={score}
        lives={lives === Infinity ? 0 : lives}
        maxLives={hudMaxLives}
        timeLeft={totalTime}
        correct={correct}
        wrong={wrong}
        streak={streak}
        onMenu={onMenu}
      />

      <div className="quiz-body">
        <div className="quiz-word-card">
          {settings.matchType === 'pinyin-english' ? (
            <span className="quiz-word-hanzi" style={{ fontSize: '2rem' }}>
              {question.word.pinyin}
            </span>
          ) : (
            <>
              <span className="quiz-word-hanzi">{question.word.hanzi}</span>
              {showPinyin && (
                <span className="quiz-word-pinyin">{question.word.pinyin}</span>
              )}
            </>
          )}
        </div>

        <div className="quiz-time-bar">
          <div
            className={`quiz-time-fill ${timeRatio < 0.3 ? 'low' : ''}`}
            style={{ width: `${timeRatio * 100}%` }}
          />
        </div>

        <div className="quiz-choices">
          {question.choices.map((choice, i) => {
            let cls = 'quiz-choice'
            if (chosen !== null) {
              if (i === question.correctIdx) cls += ' correct'
              else if (i === chosen) cls += ' wrong'
            }
            const useEmoji = settings.showEmoji && !!choice.emoji && settings.matchType !== 'hanzi-pinyin'
            const isPeeked = peekedChoices.has(i)
            return (
              <button
                key={choice.id}
                className={cls}
                onClick={() => handleChoice(i)}
                disabled={chosen !== null}
                style={{ position: 'relative', flexDirection: 'column', gap: 4 }}
              >
                {useEmoji && !isPeeked ? (
                  <>
                    <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{choice.emoji}</span>
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
                    {getRightContent(choice, settings.matchType)}
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
          })}
        </div>

        <div className={`quiz-feedback ${feedback ?? ''}`}>
          {feedback === 'correct' && '✓ Correct!'}
          {feedback === 'wrong' && `✗ ${getRightContent(question.word, settings.matchType)}`}
        </div>

        <div className="quiz-progress">
          {correct + wrong} answered · {Math.round((correct / Math.max(1, correct + wrong)) * 100)}% correct
        </div>
      </div>
    </div>
  )
}
