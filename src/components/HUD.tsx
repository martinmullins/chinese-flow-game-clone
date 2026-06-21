import { formatTime } from '../data'

interface Props {
  score: number
  lives: number
  timeLeft: number
  correct: number
  wrong: number
  onMenu: () => void
}

export default function HUD({ score, lives, timeLeft, correct, wrong, onMenu }: Props) {
  const isUrgent = timeLeft <= 30
  const hearts = Array.from({ length: 3 }, (_, i) => i < lives ? '❤️' : '🖤')

  return (
    <div className="hud">
      <button className="hud-btn-menu" onClick={onMenu}>
        ← Menu
      </button>

      <div className={`hud-timer ${isUrgent ? 'urgent' : ''}`}>
        {formatTime(timeLeft)}
      </div>

      <div className="hud-score">
        <span className="score-label">Score</span>
        <span className="score-val">{score}</span>
      </div>

      <div className="hud-spacer" />

      <div className="hud-stat">
        <span className="stat-label">✓</span>
        <span className="stat-val correct">{correct}</span>
      </div>

      <div className="hud-stat">
        <span className="stat-label">✗</span>
        <span className="stat-val wrong">{wrong}</span>
      </div>

      <div className="hud-lives">
        {hearts.map((h, i) => <span key={i}>{h}</span>)}
      </div>
    </div>
  )
}
