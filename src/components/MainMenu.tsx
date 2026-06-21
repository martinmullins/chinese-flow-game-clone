import { useState } from 'react'
import { GameSettings, HskLevel, GameMode, MatchType, GameVariant } from '../types'
import { getWords } from '../data'

interface Props {
  settings: GameSettings
  onStart: (settings: GameSettings) => void
}

const HSK_WORD_COUNTS: Record<HskLevel, number> = {
  1: 152, 2: 153, 3: 100, 4: 30, 5: 20, 6: 0,
}

const MODES: { id: GameMode; icon: string; name: string; desc: string }[] = [
  {
    id: 'flow',
    icon: '🌊',
    name: 'Flow Match',
    desc: 'Two columns — click a Chinese card then its matching meaning. Classic mode.',
  },
  {
    id: 'quiz',
    icon: '⚡',
    name: 'Speed Quiz',
    desc: 'A character flashes on screen — pick the correct meaning from 4 choices before time runs out.',
  },
  {
    id: 'rain',
    icon: '☔',
    name: 'Character Rain',
    desc: 'Characters fall from the sky — click one, then choose its meaning before it hits the ground.',
  },
]

const DURATIONS = [60, 120, 180, 300]

const VARIANTS: { id: GameVariant; icon: string; name: string; desc: string }[] = [
  {
    id: 'standard',
    icon: '🎮',
    name: 'Standard',
    desc: 'Timed session. Wrong answers cost a life.',
  },
  {
    id: 'time-attack',
    icon: '⏱️',
    name: 'Time Attack',
    desc: 'Correct +5 s · Wrong −3 s. Start with 30 s. Chain a streak to multiply your score.',
  },
  {
    id: 'sudden-death',
    icon: '💀',
    name: 'Sudden Death',
    desc: 'One wrong answer ends the game. How far can you go?',
  },
]

export default function MainMenu({ settings, onStart }: Props) {
  const [s, setS] = useState<GameSettings>(settings)

  const toggleLevel = (level: HskLevel) => {
    setS(prev => {
      const has = prev.hskLevels.includes(level)
      const next = has
        ? prev.hskLevels.filter(l => l !== level)
        : [...prev.hskLevels, level].sort()
      return { ...prev, hskLevels: next.length === 0 ? [level] : next }
    })
  }

  const wordCount = getWords(s.hskLevels).length

  return (
    <div className="screen">
      <div className="menu-screen">
        <div className="menu-title">
          <span className="hanzi">汉字流</span>
          <span className="eng">Chinese Flow · HSK Trainer</span>
        </div>

        {/* HSK Level */}
        <div className="menu-section">
          <h2>HSK Level</h2>
          <div className="level-grid">
            {([1, 2, 3, 4, 5, 6] as HskLevel[]).map(level => (
              <button
                key={level}
                className={`level-btn ${s.hskLevels.includes(level) ? 'active' : ''}`}
                onClick={() => toggleLevel(level)}
                title={`${HSK_WORD_COUNTS[level]} words`}
              >
                <span className="lnum">{level}</span>
                <span className="lwc">{HSK_WORD_COUNTS[level]}w</span>
              </button>
            ))}
          </div>
          <div className="word-count-badge" style={{ marginTop: 12 }}>
            <strong>{wordCount}</strong> words available
          </div>
        </div>

        {/* Game Mode */}
        <div className="menu-section">
          <h2>Game Mode</h2>
          <div className="mode-grid">
            {MODES.map(m => (
              <button
                key={m.id}
                className={`mode-btn ${s.gameMode === m.id ? 'active' : ''}`}
                onClick={() => setS(prev => ({ ...prev, gameMode: m.id }))}
              >
                <span className="mode-icon">{m.icon}</span>
                <span className="mode-info">
                  <span className="mode-name">{m.name}</span>
                  <span className="mode-desc">{m.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Match Type */}
        <div className="menu-section">
          <h2>Match Type</h2>
          <div className="match-grid">
            {(
              [
                { id: 'hanzi-english', left: '汉字', right: 'English' },
                { id: 'hanzi-pinyin', left: '汉字', right: 'Pīnyīn' },
                { id: 'pinyin-english', left: 'Pīnyīn', right: 'English' },
              ] as { id: MatchType; left: string; right: string }[]
            ).map(({ id, left, right }) => (
              <button
                key={id}
                className={`match-btn ${s.matchType === id ? 'active' : ''}`}
                onClick={() => setS(prev => ({ ...prev, matchType: id }))}
              >
                <span>{left}</span>
                <span className="match-arrow">→</span>
                <span>{right}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Game Variant */}
        <div className="menu-section">
          <h2>Variant</h2>
          <div className="mode-grid">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                className={`mode-btn ${s.gameVariant === v.id ? 'active' : ''}`}
                onClick={() => setS(prev => ({ ...prev, gameVariant: v.id }))}
              >
                <span className="mode-icon">{v.icon}</span>
                <span className="mode-info">
                  <span className="mode-name">{v.name}</span>
                  <span className="mode-desc">{v.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="menu-section">
          <h2>Options</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={s.showEmoji}
                onChange={e => setS(prev => ({ ...prev, showEmoji: e.target.checked }))}
              />
              <span>
                Use emoji instead of English
                <small style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 400 }}>
                  Click the <strong>?</strong> on a card to peek at the translation
                </small>
              </span>
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={s.showPinyinHint}
                onChange={e => setS(prev => ({ ...prev, showPinyinHint: e.target.checked }))}
              />
              Show pinyin hint on Chinese cards
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={s.stageMode}
                onChange={e => setS(prev => ({ ...prev, stageMode: e.target.checked }))}
              />
              <span>
                Stage Mode — groups of 30
                <small style={{ display: 'block', color: 'var(--text-dim)', fontWeight: 400 }}>
                  Work through 30 words at a time. Wrong answers re-queue until you get them right.
                </small>
              </span>
            </label>

            {s.gameVariant !== 'time-attack' && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: 8 }}>
                  Game Duration
                </div>
                <div className="duration-select">
                  {DURATIONS.map(d => (
                    <button
                      key={d}
                      className={`dur-btn ${s.gameDuration === d ? 'active' : ''}`}
                      onClick={() => setS(prev => ({ ...prev, gameDuration: d }))}
                    >
                      {d < 60 ? `${d}s` : `${d / 60}m`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {wordCount < 4 && (
          <div className="no-words-warning">
            Not enough words — please select at least one HSK level with available words.
          </div>
        )}

        <button
          className="start-btn"
          onClick={() => onStart(s)}
          disabled={wordCount < 4}
        >
          <span className="btn-hanzi">开始</span>
          Start Game
        </button>
      </div>
    </div>
  )
}
