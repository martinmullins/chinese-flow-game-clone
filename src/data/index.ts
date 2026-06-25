import { VocabWord, HskLevel, MatchType } from '../types'
import { vocabulary } from './vocabulary'

export { vocabulary }

export function getWords(levels: HskLevel[]): VocabWord[] {
  return vocabulary.filter(w => levels.includes(w.hskLevel))
}

export function getLeftContent(word: VocabWord, matchType: MatchType): string {
  return matchType === 'pinyin-english' ? word.pinyin : word.hanzi
}

export function getRightContent(word: VocabWord, matchType: MatchType): string {
  if (matchType === 'hanzi-english') return word.english
  if (matchType === 'hanzi-pinyin') return word.pinyin
  return word.english
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getDistractors(
  correct: VocabWord,
  pool: VocabWord[],
  count: number
): VocabWord[] {
  const others = pool.filter(w => w.id !== correct.id)
  return shuffle(others).slice(0, count)
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export const STAGE_SIZE = 30

export function getStageWords(allWords: VocabWord[], stage: number): VocabWord[] {
  const start = (stage - 1) * STAGE_SIZE
  return allWords.slice(start, start + STAGE_SIZE)
}

export function getTotalStages(allWords: VocabWord[]): number {
  return Math.max(1, Math.ceil(allWords.length / STAGE_SIZE))
}

// Group count: merges tiny trailing groups (< 8 words) into the previous group.
export function getGroupCount(words: VocabWord[]): number {
  if (words.length <= STAGE_SIZE) return 1
  const full = Math.floor(words.length / STAGE_SIZE)
  const rem  = words.length % STAGE_SIZE
  return rem > 0 && rem < 8 ? full : full + (rem > 0 ? 1 : 0)
}

// Returns words for a 1-based group index; last group absorbs any overflow.
export function getGroupWords(words: VocabWord[], groupIdx: number): VocabWord[] {
  const total = getGroupCount(words)
  const start = (groupIdx - 1) * STAGE_SIZE
  return groupIdx >= total ? words.slice(start) : words.slice(start, start + STAGE_SIZE)
}

export function getStreakMultiplier(streak: number): number {
  if (streak < 3)  return 1
  if (streak < 6)  return 2
  if (streak < 10) return 3
  if (streak < 15) return 4
  return 5
}
