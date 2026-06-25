import { GameResult, GameSettings } from '../types'

interface Props {
  result: GameResult
  settings: GameSettings
  onPlayAgain: () => void
  onMenu: () => void
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function ResultsScreen({ result, settings, onPlayAgain, onMenu }: Props) {
  const won = result.sdCompleted
  const reached = result.sdReached
  const groupSuffix = settings.groupIndex > 0 && settings.hskLevels.length === 1
    ? ` · Group ${settings.groupIndex}`
    : ''

  return (
    <div className="results-wrap">
      <div className="results-inner">

        <div className="results-hero">
          <div className="results-icon">
            {won ? '🏆' : reached ? '💥' : '📊'}
          </div>
          <h1 className="results-title">
            {won ? '完美！ Perfect' : reached ? '游戏结束 Game Over' : 'Session Complete'}
          </h1>
          <p className="results-sub">
            HSK {result.hskLevels.join(' + ')}{groupSuffix} · {result.matchType}
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-val">{result.sdCount} / {result.sdTotal}</div>
            <div className="stat-label">SD Words</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{result.phase1Misses}</div>
            <div className="stat-label">Phase 1 Misses</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">{formatTime(result.timeUsed)}</div>
            <div className="stat-label">Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">
              {result.correctWords.length + result.wrongWords.length > 0
                ? Math.round(result.correctWords.length / (result.correctWords.length + result.wrongWords.length) * 100)
                : 0}%
            </div>
            <div className="stat-label">Accuracy</div>
          </div>
        </div>

        {/* SD progress bar */}
        {reached && (
          <div className="results-sd-bar">
            <div className="results-sd-label">Sudden Death Progress</div>
            <div className="sd-track">
              <div
                className={`sd-fill${won ? ' won' : ''}`}
                style={{ width: `${(result.sdCount / result.sdTotal) * 100}%` }}
              />
            </div>
            <div className="results-sd-count">{result.sdCount} / {result.sdTotal}</div>
          </div>
        )}

        {/* Words to review */}
        {result.wrongWords.length > 0 && (
          <div className="word-section">
            <h3 className="word-section-title">Review ({result.wrongWords.length})</h3>
            <div className="word-list">
              {Array.from(new Map(result.wrongWords.map(w => [w.id, w])).values()).map(word => (
                <div className="word-row" key={word.id}>
                  <span className="wr-hanzi wrong-word">{word.hanzi}</span>
                  <span className="wr-pinyin">{word.pinyin}</span>
                  <span className="wr-en">{word.english}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="results-actions">
          <button className="btn-primary" onClick={onPlayAgain}>Play Again</button>
          <button className="btn-secondary" onClick={onMenu}>← Menu</button>
        </div>
      </div>
    </div>
  )
}
