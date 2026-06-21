export interface VocabWord {
  id: string
  hanzi: string
  pinyin: string
  english: string
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6
  emoji?: string
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

export type GameMode = 'flow' | 'quiz' | 'rain'

export type MatchType = 'hanzi-english' | 'hanzi-pinyin' | 'pinyin-english'

export type GameVariant = 'standard' | 'time-attack' | 'sudden-death'

export interface GameSettings {
  hskLevels: HskLevel[]
  gameMode: GameMode
  matchType: MatchType
  showPinyinHint: boolean
  showEmoji: boolean
  gameDuration: number
  gridSize: number
  gameVariant: GameVariant
}

export interface GameResult {
  score: number
  correct: number
  wrong: number
  timeUsed: number
  gameMode: GameMode
  hskLevels: HskLevel[]
  correctWords: VocabWord[]
  wrongWords: VocabWord[]
  maxStreak: number
  gameVariant: GameVariant
}

export type Screen = 'menu' | 'game' | 'results'
