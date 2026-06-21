import { useState } from 'react'
import { GameSettings, GameResult, Screen } from './types'
import MainMenu from './components/MainMenu'
import FlowGame from './components/FlowGame'
import QuizGame from './components/QuizGame'
import RainGame from './components/RainGame'
import ResultsScreen from './components/ResultsScreen'

const DEFAULT_SETTINGS: GameSettings = {
  hskLevels: [1],
  gameMode: 'flow',
  matchType: 'hanzi-english',
  showPinyinHint: false,
  showEmoji: true,
  gameDuration: 180,
  gridSize: 5,
  gameVariant: 'standard',
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS)
  const [result, setResult] = useState<GameResult | null>(null)

  const handleStart = (newSettings: GameSettings) => {
    setSettings(newSettings)
    setScreen('game')
  }

  const handleGameOver = (gameResult: GameResult) => {
    setResult(gameResult)
    setScreen('results')
  }

  const handlePlayAgain = () => {
    setScreen('game')
  }

  const handleMenu = () => {
    setScreen('menu')
  }

  if (screen === 'menu') {
    return <MainMenu settings={settings} onStart={handleStart} />
  }

  if (screen === 'results' && result) {
    return (
      <ResultsScreen
        result={result}
        settings={settings}
        onPlayAgain={handlePlayAgain}
        onMenu={handleMenu}
      />
    )
  }

  if (settings.gameMode === 'flow') {
    return (
      <FlowGame
        settings={settings}
        onGameOver={handleGameOver}
        onMenu={handleMenu}
      />
    )
  }

  if (settings.gameMode === 'quiz') {
    return (
      <QuizGame
        settings={settings}
        onGameOver={handleGameOver}
        onMenu={handleMenu}
      />
    )
  }

  if (settings.gameMode === 'rain') {
    return (
      <RainGame
        settings={settings}
        onGameOver={handleGameOver}
        onMenu={handleMenu}
      />
    )
  }

  return null
}
