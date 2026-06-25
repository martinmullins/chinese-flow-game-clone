import { useState } from 'react'
import { GameSettings, GameResult } from './types'
import MainMenu from './components/MainMenu'
import QuizGame from './components/QuizGame'
import ResultsScreen from './components/ResultsScreen'

const DEFAULT_SETTINGS: GameSettings = {
  hskLevels: [1],
  groupIndex: 0,
  matchType: 'hanzi-english',
  showPinyinHint: false,
}

export default function App() {
  const [screen, setScreen]   = useState<'menu' | 'game' | 'results'>('menu')
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [result, setResult]   = useState<GameResult | null>(null)

  const handleStart = (s: GameSettings) => {
    setSettings(s)
    setScreen('game')
  }

  const handleGameOver = (r: GameResult) => {
    setResult(r)
    setScreen('results')
  }

  if (screen === 'menu') {
    return <MainMenu settings={settings} onStart={handleStart} />
  }

  if (screen === 'results' && result) {
    return (
      <ResultsScreen
        result={result}
        settings={settings}
        onPlayAgain={() => setScreen('game')}
        onMenu={() => setScreen('menu')}
      />
    )
  }

  return (
    <QuizGame
      settings={settings}
      onGameOver={handleGameOver}
      onMenu={() => setScreen('menu')}
    />
  )
}
