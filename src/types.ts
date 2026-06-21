export interface VocabWord {
  id: string
  hanzi: string
  pinyin: string
  english: string
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

export type GameMode = 'flow' | 'quiz' | 'rain'

export type MatchType = 'hanzi-english' | 'hanzi-pinyin' | 'pinyin-english'

export interface GameSettings {
  hskLevels: HskLevel[]
  gameMode: GameMode
  matchType: MatchType
  showPinyinHint: boolean
  gameDuration: number
  gridSize: number
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
}

export type Screen = 'menu' | 'game' | 'results'
