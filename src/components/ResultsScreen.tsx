import { GameResult, GameSettings } from '../types'
import { formatTime } from '../data'

interface Props {
  result: GameResult
  settings: GameSettings
  onPlayAgain: () => void
  onMenu: () => void
}

const MODE_NAMES = { flow: '🌊 Flow Match', quiz: '⚡ Speed Quiz', rain: '☔ Character Rain' }

export default function ResultsScreen({ result, settings, onPlayAgain, onMenu }: Props) {
  const pct = result.correct + result.wrong > 0
    ? Math.round((result.correct / (result.correct + result.wrong)) * 100)
    : 0

  const grade =
    pct >= 90 ? { label: '优秀', color: '#ffd166', eng: 'Excellent!' } :
    pct >= 75 ? { label: '良好', color: '#06d6a0', eng: 'Good job!' } :
    pct >= 60 ? { label: '及格', color: '#4361ee', eng: 'Keep going!' } :
                { label: '加油', color: '#e63946', eng: 'Practice more!' }

  return (
    <div className="screen">
      <div className="results-screen">
        <div className="results-header">
          <h1 style={{ color: grade.color }}>{grade.label}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            {grade.eng} &nbsp;·&nbsp; {MODE_NAMES[result.gameMode]}
            &nbsp;·&nbsp; HSK {result.hskLevels.join('+')}
          </p>
        </div>

        <div className="results-hero">
          <div className="results-stat">
            <div className="rs-val score">{result.score}</div>
            <div className="rs-label">Score</div>
          </div>
          <div className="results-stat">
            <div className="rs-val correct">{result.correct}</div>
            <div className="rs-label">Correct</div>
          </div>
          <div className="results-stat">
            <div className="rs-val wrong">{result.wrong}</div>
            <div className="rs-label">Wrong</div>
          </div>
        </div>

        {/* Extra stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {[
            { label: 'Accuracy', val: `${pct}%` },
            { label: 'Time', val: formatTime(result.timeUsed) },
            { label: 'Per Min', val: result.timeUsed > 0
                ? `${Math.round(result.correct / (result.timeUsed / 60))}`
                : '—'
            },
          ].map(({ label, val }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)' }}>{val}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Words to review */}
        {result.wrongWords.length > 0 && (
          <div className="results-section">
            <h3>Review These ({result.wrongWords.length})</h3>
            <div className="word-list">
              {result.wrongWords.map((word, i) => (
                <div className="word-row" key={`wrong-${word.id}-${i}`}>
                  <span className="wr-hanzi" style={{ color: 'var(--red)' }}>{word.hanzi}</span>
                  <span className="wr-pinyin">{word.pinyin}</span>
                  <span className="wr-en">{word.english}</span>
                  <span className="wr-hsk">HSK{word.hskLevel}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Words mastered */}
        {result.correctWords.length > 0 && (
          <div className="results-section">
            <h3>Mastered ({result.correctWords.length})</h3>
            <div className="word-list">
              {result.correctWords.slice(0, 20).map((word, i) => (
                <div className="word-row" key={`correct-${word.id}-${i}`}>
                  <span className="wr-hanzi" style={{ color: 'var(--green)' }}>{word.hanzi}</span>
                  <span className="wr-pinyin">{word.pinyin}</span>
                  <span className="wr-en">{word.english}</span>
                  <span className="wr-hsk">HSK{word.hskLevel}</span>
                </div>
              ))}
              {result.correctWords.length > 20 && (
                <div className="empty-state">
                  + {result.correctWords.length - 20} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* HSK level breakdown */}
        {result.hskLevels.length > 1 && (
          <div className="results-section">
            <h3>HSK Breakdown</h3>
            <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {result.hskLevels.map(lvl => {
                const c = result.correctWords.filter(w => w.hskLevel === lvl).length
                const w = result.wrongWords.filter(w => w.hskLevel === lvl).length
                const total = c + w
                const pct = total > 0 ? Math.round((c / total) * 100) : 0
                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', width: 42, flexShrink: 0 }}>HSK {lvl}</span>
                    <div style={{
                      flex: 1, height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%', background: 'var(--green)', borderRadius: 4,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-mid)', width: 48, textAlign: 'right', flexShrink: 0 }}>
                      {c}/{total} {total > 0 ? `(${pct}%)` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Settings used */}
        <div style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <span>Mode: <strong style={{ color: 'var(--text-mid)' }}>{MODE_NAMES[settings.gameMode]}</strong></span>
          <span>·</span>
          <span>Match: <strong style={{ color: 'var(--text-mid)' }}>{settings.matchType}</strong></span>
          <span>·</span>
          <span>Duration: <strong style={{ color: 'var(--text-mid)' }}>{settings.gameDuration / 60}m</strong></span>
        </div>

        <div className="results-actions">
          <button className="btn-play-again" onClick={onPlayAgain}>
            Play Again
          </button>
          <button className="btn-menu" onClick={onMenu}>
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  )
}
