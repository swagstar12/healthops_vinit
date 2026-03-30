import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth'

type Message = {
  id: number
  role: 'user' | 'bot'
  text: string
  timestamp: Date
  suggestions?: string[]
}

type HistoryEntry = {
  role: 'user' | 'model'
  parts: string
}

// ─── Role-based suggestion pools ─────────────────────────────────────────────

const SUGGESTIONS: Record<string, string[][]> = {
  DOCTOR: [
    ['Show my availability schedule', 'Do I have any holidays coming up?', 'How do I create a visit?'],
    ['Show my patient list', 'How do I write a prescription?', 'How do I edit a visit?'],
    ['How do I add availability?', 'How do I download a patient report?', 'What are my stats today?'],
    ['How do I delete a holiday?', 'How do I update patient info?', 'Show today\'s visit count'],
  ],
  RECEPTIONIST: [
    ['How do I book an appointment?', 'How do I register a new patient?', 'Show today\'s appointments'],
    ['How do I cancel an appointment?', 'How do I search for a patient?', 'How do I add a doctor?'],
    ['How do I manage doctor schedules?', 'How do I download a report?', 'How do I update a patient?'],
    ['How do I mark appointment as completed?', 'How do I add a doctor holiday?', 'Show appointment stats'],
  ],
  ADMIN: [
    ['Show dashboard statistics', 'How do I add a new doctor?', 'How do I add a receptionist?'],
    ['How do I disable a user account?', 'How many patients do we have?', 'Show today\'s appointments'],
    ['How do I delete a doctor?', 'How do I enable a disabled user?', 'Show total visits count'],
    ['How do I update doctor info?', 'Show all receptionists', 'What are the system stats?'],
  ],
}

function getInitialMessage(role: string): Message {
  const greetings: Record<string, string> = {
    DOCTOR: `Hi Doctor! 👨‍⚕️ I'm HealthBot, your assistant at Meera Hospital.\n\nI can help you with:\n• Your schedule & holidays\n• Patient records & visits\n• Reports & statistics\n\nWhat would you like to know?`,
    RECEPTIONIST: `Hi! 👋 I'm HealthBot, your reception assistant at Meera Hospital.\n\nI can help you with:\n• Booking & managing appointments\n• Registering patients\n• Doctor schedules & reports\n\nHow can I assist you today?`,
    ADMIN: `Hi Admin! 🏥 I'm HealthBot, your system assistant at Meera Hospital.\n\nI can help you with:\n• System statistics & overview\n• Managing doctors & receptionists\n• User account controls\n\nWhat do you need help with?`,
  }

  return {
    id: 1,
    role: 'bot',
    text: greetings[role] || `Hi! I'm HealthBot 🏥 How can I help you?`,
    timestamp: new Date(),
    suggestions: SUGGESTIONS[role]?.[0] ?? [],
  }
}

// ─── Pick next suggestion set (rotates through available sets) ────────────────
function getNextSuggestions(role: string, turnIndex: number): string[] {
  const pool = SUGGESTIONS[role] ?? []
  if (pool.length === 0) return []
  return pool[turnIndex % pool.length]
}

// ─── Parse bot reply for smart contextual suggestions ────────────────────────
function getContextualSuggestions(botReply: string, role: string, turnIndex: number): string[] {
  const reply = botReply.toLowerCase()

  if (role === 'DOCTOR') {
    if (reply.includes('availab'))
      return ['How do I add more availability?', 'Show my holidays', 'What are today\'s visits?']
    if (reply.includes('holiday'))
      return ['How do I add a holiday?', 'Show my availability', 'Show my patient list']
    if (reply.includes('visit') || reply.includes('diagnosis'))
      return ['How do I edit this visit?', 'How do I download visit report?', 'Show all my visits']
    if (reply.includes('patient'))
      return ['How do I edit patient info?', 'Show visit history for a patient', 'Download patient report']
    if (reply.includes('report') || reply.includes('csv'))
      return ['Download all visits CSV', 'Download patient-specific report', 'Show my stats']
    if (reply.includes('stat') || reply.includes('dashboard'))
      return ['Show my patient list', 'Show today\'s visits', 'Show my schedule']
  }

  if (role === 'RECEPTIONIST') {
    if (reply.includes('appointment'))
      return ['How do I cancel this appointment?', 'How do I reschedule?', 'Show all today\'s appointments']
    if (reply.includes('patient') && reply.includes('register'))
      return ['How do I search for a patient?', 'How do I book an appointment now?', 'How do I edit patient details?']
    if (reply.includes('doctor') || reply.includes('schedule'))
      return ['How do I add availability for the doctor?', 'How do I add a doctor holiday?', 'Show all doctors']
    if (reply.includes('report') || reply.includes('csv'))
      return ['Download appointments report', 'Download patients report', 'Download patient visit history']
    if (reply.includes('stat') || reply.includes('dashboard'))
      return ['Show today\'s appointments', 'How do I book an appointment?', 'Show patient list']
  }

  if (role === 'ADMIN') {
    if (reply.includes('doctor'))
      return ['How do I disable this doctor?', 'How do I edit doctor info?', 'Show all doctors']
    if (reply.includes('receptionist'))
      return ['How do I disable this receptionist?', 'How do I add another receptionist?', 'Show all users']
    if (reply.includes('stat') || reply.includes('dashboard'))
      return ['How many doctors do we have?', 'Show today\'s appointments', 'Show total visits']
    if (reply.includes('disable') || reply.includes('enable'))
      return ['Show all users', 'How do I delete a user?', 'Show system stats']
  }

  // Fallback to rotating suggestions
  return getNextSuggestions(role, turnIndex)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ChatBotProps {
  resetKey: number   // increment this from App.tsx on logout to reset chat
}

export default function ChatBot({ resetKey }: ChatBotProps) {
  const { user } = useAuth()

  const [isOpen, setIsOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [history, setHistory]   = useState<HistoryEntry[]>([])
  const [turnIndex, setTurnIndex] = useState(0)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Reset everything when resetKey changes (i.e. user logs out then back in)
  useEffect(() => {
    if (user) {
      setMessages([getInitialMessage(user.role)])
      setHistory([])
      setTurnIndex(0)
      setInput('')
      setIsOpen(false)
    }
  }, [resetKey, user])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!user) return null

  // ─── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || loading) return

    setInput('')

    const userMsg: Message = {
      id: Date.now(),
      role: 'user',
      text: userText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await fetch('/chatbot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          role: user.role,
          token: user.token,
          history,
        }),
      })

      const data = await response.json()
      const botReply: string = data.reply || 'Sorry, I could not process that.'
      const newTurnIndex = turnIndex + 1

      const suggestions = getContextualSuggestions(botReply, user.role, newTurnIndex)

      const botMsg: Message = {
        id: Date.now() + 1,
        role: 'bot',
        text: botReply,
        timestamp: new Date(),
        suggestions,
      }

      setMessages(prev => [...prev, botMsg])
      setHistory(prev => [
        ...prev,
        { role: 'user',  parts: userText  },
        { role: 'model', parts: botReply  },
      ])
      setTurnIndex(newTurnIndex)

    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'bot',
        text: '⚠️ Could not reach HealthBot. Please check your connection.',
        timestamp: new Date(),
        suggestions: getNextSuggestions(user.role, turnIndex),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  const roleColors: Record<string, string> = {
    DOCTOR:       'bg-blue-600',
    RECEPTIONIST: 'bg-green-600',
    ADMIN:        'bg-purple-600',
  }
  const headerColor = roleColors[user.role] ?? 'bg-blue-600'

  return (
    <>
      {/* ── Floating Button ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 ${headerColor}
                    text-white rounded-full shadow-xl flex items-center justify-center
                    text-2xl transition-all duration-300 hover:scale-110`}
        title="HealthBot Assistant"
      >
        {isOpen ? '✕' : '🤖'}
      </button>

      {/* ── Chat Window ── */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl
                        shadow-2xl flex flex-col overflow-hidden border border-gray-200">

          {/* Header */}
          <div className={`${headerColor} text-white px-4 py-3 flex items-center space-x-3`}>
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg">
              🤖
            </div>
            <div>
              <p className="font-semibold text-sm">HealthBot</p>
              <p className="text-xs text-white/80">
                Meera Hospital • {user.role} • {user.fullName}
              </p>
            </div>
            <div className="ml-auto flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-400 rounded-full" title="Online" />
              {/* Clear / restart chat button */}
              <button
                onClick={() => {
                  setMessages([getInitialMessage(user.role)])
                  setHistory([])
                  setTurnIndex(0)
                }}
                className="text-white/70 hover:text-white text-xs underline"
                title="Start new conversation"
              >
                New chat
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map(msg => (
              <div key={msg.id} className="space-y-2">

                {/* Bubble */}
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className={`w-7 h-7 ${headerColor} rounded-full flex items-center
                                    justify-center text-xs mr-2 flex-shrink-0 mt-1 text-white`}>
                      🤖
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed
                      ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 shadow-sm rounded-bl-sm border border-gray-100'
                      }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {msg.text}
                    <span className={`block text-xs mt-1 
                      ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Suggestion chips — only on bot messages */}
                {msg.role === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pl-9">
                    {msg.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        disabled={loading}
                        className="text-xs bg-white border border-gray-300 text-gray-700
                                   rounded-full px-3 py-1 hover:border-blue-400 hover:text-blue-600
                                   hover:bg-blue-50 transition-colors disabled:opacity-50
                                   disabled:cursor-not-allowed shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className={`w-7 h-7 ${headerColor} rounded-full flex items-center
                                justify-center text-xs mr-2 flex-shrink-0 text-white`}>
                  🤖
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex space-x-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                         style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                         style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                         style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-200">
            <div className="flex items-end space-x-2">
              <textarea
                className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2
                           text-sm focus:outline-none focus:ring-2 focus:ring-blue-400
                           max-h-24 min-h-[40px]"
                placeholder="Ask HealthBot anything..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className={`w-10 h-10 ${headerColor} hover:opacity-90 disabled:bg-gray-300
                           text-white rounded-xl flex items-center justify-center
                           transition-all flex-shrink-0 text-lg`}
              >
                ➤
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">
              Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  )
}