import { formatTime, getStreakMultiplier } from '../data'

interface Props {
  score: number
  lives: number
  maxLives?: number   // 0 = hide hearts entirely
  timeLeft: number
  correct: number
  wrong: number
  streak?: number
  stageInfo?: { stage: number; total: number; done: number; size: number }
  onMenu: () => void
}

export default function HUD({ score, lives, maxLives = 3, timeLeft, correct, wrong, streak = 0, stageInfo, onMenu }: Props) {
  const isUrgent = timeLeft <= 30
  const mult = getStreakMultiplier(streak)

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

      {stageInfo && (
        <div className="hud-stage-info">
          <span className="stage-tag">S{stageInfo.stage}/{stageInfo.total}</span>
          <span className="stage-progress">{stageInfo.done}/{stageInfo.size}</span>
        </div>
      )}

      {streak >= 3 && (
        <div className="hud-streak">
          <span className="streak-count">🔥{streak}</span>
          <span className="streak-mult">×{mult}</span>
        </div>
      )}

      <div className="hud-spacer" />

      <div className="hud-stat">
        <span className="stat-label">✓</span>
        <span className="stat-val correct">{correct}</span>
      </div>

      <div className="hud-stat">
        <span className="stat-label">✗</span>
        <span className="stat-val wrong">{wrong}</span>
      </div>

      {maxLives > 0 && (
        <div className="hud-lives">
          {Array.from({ length: maxLives }, (_, i) => (
            <span key={i}>{i < lives ? '❤️' : '🖤'}</span>
          ))}
        </div>
      )}
    </div>
  )
}
