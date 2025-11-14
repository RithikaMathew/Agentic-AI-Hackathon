import React, { useState } from 'react'

declare const chrome: any

type Step = { instruction: string; target_text?: string }

export default function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Array<{ from: string; text: string }>>([])

  async function send() {
    if (!input.trim()) return
    const userText = input.trim()
    setMessages((m) => [...m, { from: 'user', text: userText }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      })
      const data = await res.json()
      // data.steps expected
      const steps: Step[] = data.steps || []
      setMessages((m) => [...m, { from: 'assistant', text: (data.summary || 'I created steps') }])

      // send to content script
      const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve))
      if (tabs && tabs.length) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'apply_steps', steps }, (resp) => {
          console.log('apply_steps response', resp)
        })
      }
    } catch (e) {
      console.error(e)
      setMessages((m) => [...m, { from: 'assistant', text: 'Error contacting backend' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-root">
      <div className="header">FAU Assistant</div>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}>
            <div className="text">{m.text}</div>
          </div>
        ))}
      </div>
      <div className="controls">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask: How do I register for classes?" />
        <button onClick={send} disabled={loading}>{loading ? 'Working…' : 'Send'}</button>
      </div>
    </div>
  )
}
