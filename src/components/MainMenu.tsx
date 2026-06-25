import { useState } from 'react'
import { GameSettings, HskLevel, MatchType } from '../types'
import { getWords } from '../data'

interface Props {
  settings: GameSettings
  onStart: (settings: GameSettings) => void
}

const HSK_COUNTS: Record<HskLevel, number> = { 1: 152, 2: 153, 3: 100, 4: 30, 5: 20, 6: 0 }

const MATCH_OPTIONS: { id: MatchType; label: string; sub: string }[] = [
  { id: 'hanzi-english', label: '汉字  →  English',   sub: 'See character, choose meaning' },
  { id: 'hanzi-pinyin',  label: '汉字  →  Pīnyīn',    sub: 'See character, choose pronunciation' },
  { id: 'pinyin-english',label: 'Pīnyīn  →  English', sub: 'See pinyin, choose meaning' },
]

export default function MainMenu({ settings, onStart }: Props) {
  const [s, setS] = useState<GameSettings>(settings)

  const toggleLevel = (level: HskLevel) => {
    setS(prev => {
      const has  = prev.hskLevels.includes(level)
      const next = has
        ? prev.hskLevels.filter(l => l !== level)
        : [...prev.hskLevels, level].sort((a, b) => a - b)
      return { ...prev, hskLevels: next.length === 0 ? [level] : next }
    })
  }

  const wordCount = getWords(s.hskLevels).length

  return (
    <div className="menu-wrap">
      <div className="menu-inner">

        <header className="menu-header">
          <h1 className="menu-logo">汉字流</h1>
          <p className="menu-tagline">Chinese Flow · HSK Trainer</p>
        </header>

        {/* HSK Levels */}
        <section className="menu-section">
          <h2 className="section-label">HSK Level</h2>
          <div className="hsk-grid">
            {([1, 2, 3, 4, 5] as HskLevel[]).map(lvl => (
              <button
                key={lvl}
                className={`hsk-btn${s.hskLevels.includes(lvl) ? ' active' : ''}`}
                onClick={() => toggleLevel(lvl)}
              >
                <span className="hsk-num">{lvl}</span>
                <span className="hsk-count">{HSK_COUNTS[lvl]}w</span>
              </button>
            ))}
          </div>
          <div className="word-pill">{wordCount} words</div>
        </section>

        {/* Match Type */}
        <section className="menu-section">
          <h2 className="section-label">Match Type</h2>
          <div className="match-list">
            {MATCH_OPTIONS.map(({ id, label, sub }) => (
              <button
                key={id}
                className={`match-row${s.matchType === id ? ' active' : ''}`}
                onClick={() => setS(prev => ({ ...prev, matchType: id }))}
              >
                <span className="match-label">{label}</span>
                <span className="match-sub">{sub}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Options */}
        <section className="menu-section">
          <h2 className="section-label">Options</h2>
          <label className="toggle-row">
            <span className="toggle-text">Show pinyin under character</span>
            <input
              type="checkbox"
              className="toggle-input"
              checked={s.showPinyinHint}
              onChange={e => setS(prev => ({ ...prev, showPinyinHint: e.target.checked }))}
            />
            <span className="toggle-track" />
          </label>
        </section>

        <div className="menu-how">
          <p>Phase 1 — work through all words. Miss one? It needs 2 more correct to clear.</p>
          <p>Phase 2 — 💀 Sudden Death. Every word, one shot, no mistakes.</p>
        </div>

        <button
          className="start-btn"
          onClick={() => onStart(s)}
          disabled={wordCount < 8}
        >
          开始 · Start
        </button>

        {wordCount < 8 && (
          <p className="warn-text">Select at least one HSK level with words.</p>
        )}

      </div>
    </div>
  )
}
