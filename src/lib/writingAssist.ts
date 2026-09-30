export type WritingKind = 'title' | 'description'

import type Typo from 'typo-js'

type SpellChecker = InstanceType<typeof Typo>

let spellCheckerPromise: Promise<SpellChecker> | undefined

async function spellChecker(): Promise<SpellChecker> {
  if (!spellCheckerPromise) {
    spellCheckerPromise = Promise.all([
      import('typo-js'),
      import('typo-js/dictionaries/en_US/en_US.aff?raw'),
      import('typo-js/dictionaries/en_US/en_US.dic?raw'),
    ]).then(([typoModule, affModule, dicModule]) => {
      const TypoConstructor = typoModule.default
      return new TypoConstructor('en_US', affModule.default, dicModule.default)
    })
  }
  return spellCheckerPromise
}

const MISSPELLINGS: Record<string, string> = {
  accomodate: 'accommodate',
  acheive: 'achieve',
  adress: 'address',
  alot: 'a lot',
  apparant: 'apparent',
  becuase: 'because',
  begining: 'beginning',
  beleive: 'believe',
  calender: 'calendar',
  catagory: 'category',
  definately: 'definitely',
  dependancy: 'dependency',
  enviroment: 'environment',
  existance: 'existence',
  fixign: 'fixing',
  grammer: 'grammar',
  happend: 'happened',
  immediatly: 'immediately',
  imporant: 'important',
  improt: 'import',
  langauge: 'language',
  maintanance: 'maintenance',
  memebers: 'members',
  messsage: 'message',
  mistaks: 'mistakes',
  neccessary: 'necessary',
  nicley: 'nicely',
  occured: 'occurred',
  optionn: 'option',
  pelase: 'please',
  recieve: 'receive',
  reabale: 'readable',
  relevent: 'relevant',
  rpoblems: 'problems',
  seperate: 'separate',
  setence: 'sentence',
  somethign: 'something',
  speling: 'spelling',
  teh: 'the',
  thier: 'their',
  thsi: 'this',
  tommorow: 'tomorrow',
  untill: 'until',
  usernmae: 'username',
  wierd: 'weird',
}

const TECHNICAL_WORDS = new Set([
  'api', 'bugstow', 'css', 'docker', 'github', 'html', 'http', 'https', 'indexeddb',
  'javascript', 'json', 'localhost', 'macos', 'npm', 'oauth', 'react', 'screenshot',
  'screenshots', 'sqlite', 'tailscale', 'typescript', 'ui', 'url', 'ux', 'vercel', 'vite',
])

const COMMON_FIXES: Array<[RegExp, string]> = [
  [/\b(button|it|this|that) dont\b/gi, "$1 doesn't"],
  [/\bdont\b/gi, "don't"],
  [/\bdoesnt\b/gi, "doesn't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bisnt\b/gi, "isn't"],
  [/\barent\b/gi, "aren't"],
  [/\bwasnt\b/gi, "wasn't"],
  [/\bwerent\b/gi, "weren't"],
  [/\bim\b/g, "I'm"],
  [/\bi\b/g, 'I'],
  [/\bit happen\b/gi, 'it happens'],
]

function preserveCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase()
  if (/^[A-Z]/.test(source)) return replacement[0].toUpperCase() + replacement.slice(1)
  return replacement
}

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, row) => {
    const values = new Array<number>(b.length + 1).fill(0)
    values[0] = row
    return values
  })
  for (let column = 0; column <= b.length; column += 1) rows[0][column] = column
  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      rows[row][column] = Math.min(rows[row - 1][column] + 1, rows[row][column - 1] + 1, substitution)
      if (
        row > 1 && column > 1 &&
        a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]
      ) {
        rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + 1)
      }
    }
  }
  return rows[a.length][b.length]
}

function correctWord(word: string, checker: SpellChecker): string {
  const lower = word.toLowerCase()
  const known = MISSPELLINGS[lower]
  if (known) return preserveCase(word, known)
  if (word.length < 4 || TECHNICAL_WORDS.has(lower) || /[A-Z].*[A-Z]/.test(word)) return word
  if (checker.check(word) || checker.check(lower)) return word

  const suggestion = checker.suggest(lower)[0]
  if (!suggestion || /[^a-z'-]/i.test(suggestion)) return word
  const distance = editDistance(lower, suggestion.toLowerCase())
  const limit = word.length <= 5 ? 1 : 2
  return distance <= limit ? preserveCase(word, suggestion) : word
}

function fixSpelling(value: string, checker: SpellChecker): string {
  // URLs, email addresses, inline code, file paths, and technical identifiers are left verbatim.
  return value
    .split(/(`[^`]*`|https?:\/\/\S+|www\.\S+|\b\S+@\S+\b|\b[A-Za-z]:\\\S+|\b\S+[\/_]\S+\b)/g)
    .map((part, index) => index % 2 === 1 ? part : part.replace(/\b[A-Za-z][A-Za-z']{2,}\b/g, word => correctWord(word, checker)))
    .join('')
}

function capitalizeSentences(value: string): string {
  return value.replace(/(^|[.!?]\s+|\n+)([a-z])/g, (_all, before: string, letter: string) => {
    return `${before}${letter.toUpperCase()}`
  })
}

/**
 * Makes conservative, local corrections. It never adds, removes, or reorders
 * ideas: only spacing, capitalization, punctuation, and a small typo list.
 */
export async function polishWriting(input: string, kind: WritingKind): Promise<string> {
  if (!input.trim()) return ''
  let output = input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim().replace(/[ \t]{2,}/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')

  for (const [pattern, replacement] of COMMON_FIXES) output = output.replace(pattern, replacement)
  output = fixSpelling(output, await spellChecker())
  output = capitalizeSentences(output)

  if (kind === 'description') {
    output = output
      .split('\n')
      .map(line => {
        const trimmed = line.trim()
        if (!trimmed || /[.!?:;…]$/.test(trimmed)) return trimmed
        return /[A-Za-z0-9)\]]$/.test(trimmed) ? `${trimmed}.` : trimmed
      })
      .join('\n')
  } else {
    output = output.replace(/[.]+$/, '')
  }

  return output.trim()
}

export function normalizeCustomBadge(input: string): string {
  const normalized = input.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  const capitalized = normalized[0].toUpperCase() + normalized.slice(1)
  if (capitalized.length <= 24) return capitalized
  const cut = capitalized.slice(0, 24)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace >= 12 ? cut.slice(0, lastSpace) : cut).trim()
}

export function appendSpeechTranscript(current: string, transcript: string): string {
  const addition = transcript.trim()
  if (!addition) return current
  const polishedAddition = addition[0].toUpperCase() + addition.slice(1)
  if (!current.trim()) return polishedAddition
  const separator = /\s$/.test(current) ? '' : ' '
  return `${current}${separator}${polishedAddition}`
}
