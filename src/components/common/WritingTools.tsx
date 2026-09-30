import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, WandSparkles } from 'lucide-react'
import { appendSpeechTranscript, polishWriting, type WritingKind } from '../../lib/writingAssist'

interface SpeechResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  processLocally: boolean
  onresult: ((event: { results: ArrayLike<SpeechResultLike> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
  available?: (options: { langs: string[]; processLocally: true }) => Promise<string>
  install?: (options: { langs: string[]; processLocally: true }) => Promise<boolean>
}

function speechConstructor(): SpeechRecognitionConstructor | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
}

interface WritingToolsProps {
  value: string
  kind: WritingKind
  fieldName: string
  onChange: (value: string) => void
}

export function WritingTools({ value, kind, fieldName, onChange }: WritingToolsProps) {
  const [listening, setListening] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [message, setMessage] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const startVoice = async () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    try {
      const Recognition = speechConstructor()
      if (!Recognition?.available) {
        setMessage('On-device voice input is not available in this browser.')
        return
      }

      const lang = navigator.language || 'en-US'
      let availability = await Recognition.available({ langs: [lang], processLocally: true })
      if (availability === 'downloadable' && Recognition.install) {
        setMessage('Downloading the browser’s on-device speech language…')
        const installed = await Recognition.install({ langs: [lang], processLocally: true })
        availability = installed ? 'available' : 'unavailable'
      }
      if (availability !== 'available') {
        setMessage('On-device voice input is not ready for this language.')
        return
      }

      const recognition = new Recognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = lang
      recognition.processLocally = true
      recognition.onresult = event => {
        const transcript = Array.from(event.results)
          .filter(result => result.isFinal)
          .map(result => result[0]?.transcript || '')
          .join(' ')
        if (transcript.trim()) onChange(appendSpeechTranscript(valueRef.current, transcript))
      }
      recognition.onerror = () => setMessage('Voice input stopped. Check microphone permission and try again.')
      recognition.onend = () => {
        setListening(false)
        recognitionRef.current = null
      }
      recognitionRef.current = recognition
      setMessage('Listening on this device…')
      setListening(true)
      recognition.start()
    } catch {
      setListening(false)
      setMessage('On-device voice input could not start in this browser.')
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={async () => {
          setFixing(true)
          try {
            const polished = await polishWriting(value, kind)
            if (polished) onChange(polished)
            setMessage(polished === value ? 'Spelling and grammar already look clear.' : `${fieldName} spelling and grammar fixed.`)
          } finally {
            setFixing(false)
          }
        }}
        disabled={!value.trim() || fixing}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <WandSparkles size={13} aria-hidden="true" />
        {fixing ? 'Fixing…' : 'Fix spelling & grammar'}
      </button>
      <button
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => void startVoice()}
        aria-label={listening ? `Stop dictating ${fieldName}` : `Dictate ${fieldName}`}
        title="On-device voice input"
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800 ${
          listening ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {listening ? <MicOff size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
        {listening ? 'Stop' : 'Voice'}
      </button>
      <span
        className={message ? 'max-w-52 truncate text-[10px] font-normal text-slate-400' : 'sr-only'}
        aria-live="polite"
        title={message || undefined}
      >
        {message}
      </span>
    </div>
  )
}
