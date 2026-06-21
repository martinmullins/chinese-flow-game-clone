import { useState, useEffect, useCallback, useRef } from 'react'
import { GameSettings, GameResult, VocabWord } from '../types'
import { getWords, getRightContent, shuffle, getDistractors } from '../data'
import HUD from './HUD'

interface Props {
  settings: GameSettings
  onGameOver: (result: GameResult) => void
  onMenu: () => void
}

const QUESTION_TIME = 10

interface Question {
  word: VocabWord
  choices: VocabWord[]
  correctIdx: number
}

export default function QuizGame({ settings, onGameOver, onMenu }: Props) {
  const [, setPool]               = useState<VocabWord[]>([])
  const [question, setQuestion]   = useState<Question | null>(null)
  const [qTime, setQTime]         = useState(QUESTION_TIME)
  const [chosen, setChosen]       = useState<number | null>(null)
  const [feedback, setFeedback]   = useState<'correct' | 'wrong' | null>(null)

  const [score, setScore]           = useState(0)
  const [correct, setCorrect]       = useState(0)
  const [wrong, setWrong]           = useState(0)
  const [totalTime, setTotalTime]   = useState(settings.gameDuration)
  const [isActive, setIsActive]     = useState(false)
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([])
  const [wrongWords, setWrongWords]     = useState<VocabWord[]>([])

  const poolRef      = useRef<VocabWord[]>([])
  const allWordsRef  = useRef<VocabWord[]>([])
  const transitioning = useRef(false)

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
    const t = setTimeout(() => setTotalTime(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [isActive, totalTime])

  useEffect(() => {
    if (totalTime <= 0 && isActive) {
      setIsActive(false)
      setTimeout(() => {
        onGameOver({
          score,
          correct,
          wrong,
          timeUsed: settings.gameDuration,
          gameMode: 'quiz',
          hskLevels: settings.hskLevels,
          correctWords,
          wrongWords,
        })
      }, 600)
    }
  }, [totalTime])

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
    transitioning.current = false
  }, [])

  const advance = useCallback(() => {
    if (transitioning.current) return
    transitioning.current = true
    setTimeout(() => nextQuestion(allWordsRef.current), 1000)
  }, [nextQuestion])

  const handleChoice = useCallback((idx: number) => {
    if (chosen !== null || !question || transitioning.current) return
    setChosen(idx)

    if (idx === question.correctIdx) {
      setFeedback('correct')
      setScore(s => s + 1)
      setCorrect(s => s + 1)
      setCorrectWords(ws => [...ws, question.word])
    } else {
      setFeedback('wrong')
      setWrong(s => s + 1)
      setWrongWords(ws => [...ws, question.word])
    }
    advance()
  }, [chosen, question, advance])

  const handleTimeout = useCallback(() => {
    if (chosen !== null || !question || transitioning.current) return
    setChosen(-1)
    setFeedback('wrong')
    setWrong(s => s + 1)
    if (question) setWrongWords(ws => [...ws, question.word])
    advance()
  }, [chosen, question, advance])

  if (!question) return null

  const timeRatio = qTime / QUESTION_TIME
  const showPinyin = settings.showPinyinHint || settings.matchType === 'hanzi-pinyin'

  return (
    <div className="quiz-screen">
      <HUD
        score={score}
        lives={3}
        timeLeft={totalTime}
        correct={correct}
        wrong={wrong}
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
            return (
              <button
                key={choice.id}
                className={cls}
                onClick={() => handleChoice(i)}
                disabled={chosen !== null}
              >
                {getRightContent(choice, settings.matchType)}
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
