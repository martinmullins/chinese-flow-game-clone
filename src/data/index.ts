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
