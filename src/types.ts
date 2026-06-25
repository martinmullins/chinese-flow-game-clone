export interface VocabWord {
  id: string
  hanzi: string
  pinyin: string
  english: string
  hskLevel: 1 | 2 | 3 | 4 | 5 | 6
  emoji?: string
}

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6

export type MatchType = 'hanzi-english' | 'hanzi-pinyin' | 'pinyin-english'

export interface GameSettings {
  hskLevels: HskLevel[]
  matchType: MatchType
  showPinyinHint: boolean
}

export interface GameResult {
  hskLevels: HskLevel[]
  matchType: MatchType
  phase1Misses: number
  sdCompleted: boolean
  sdReached: boolean
  sdCount: number
  sdTotal: number
  correctWords: VocabWord[]
  wrongWords: VocabWord[]
  timeUsed: number
}

export type Screen = 'menu' | 'game' | 'results'
