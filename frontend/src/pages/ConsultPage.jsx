import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Send, Dumbbell, ChevronRight, Clock, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { getOrCreateDeviceUuid } from '../utils/deviceUuid'
import { getMe } from '../api/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatDate(iso) {
  const d = new Date(iso), now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return '오늘'
  if (diff < 172800) return '어제'
  return `${Math.floor(diff / 86400)}일 전`
}

const QUICK_QUESTIONS = [
  '오늘 운동 추천',
  '벤치프레스 1RM 증량 방법',
  '초보자 시작 방법',
]

// ─── BotAvatar ────────────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div style={{
      width: 36, height: 36,
      background: 'linear-gradient(135deg, #FFD700, #C8A200)',
      borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 0 14px rgba(255,215,0,0.25)',
    }}>
      <Dumbbell size={19} color="#000" strokeWidth={2.8} />
    </div>
  )
}

// ─── Message ──────────────────────────────────────────────────────────────────

function Message({ msg }) {
  const isBot = msg.role === 'bot'

  if (isBot) return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 56, animation: 'float-up 0.3s ease' }}>
      <BotAvatar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, color: 'rgba(226,226,226,0.85)', lineHeight: 1.85,
        }}
          className="md-bot"
        >
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
          {msg.time}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 56, animation: 'float-up 0.3s ease' }}>
      <div style={{ maxWidth: '68%' }}>
        <div style={{
          padding: '12px 18px',
          borderRadius: '4px 1px 4px 4px',
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(200,162,0,0.1))',
          border: '1px solid rgba(255,215,0,0.2)',
          fontSize: 14, color: '#E2E2E2', lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
        }}>
          {msg.text}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5, textAlign: 'right' }}>
          {msg.time}
        </div>
      </div>
    </div>
  )
}

// ─── RenameModal ──────────────────────────────────────────────────────────────

function RenameModal({ title, onConfirm, onCancel }) {
  const [draft, setDraft] = useState(title)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const confirm = () => { if (draft.trim()) onConfirm(draft.trim()) }

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4, padding: '28px 28px 24px', width: 380,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        animation: 'float-up 0.2s ease',
      }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 20, color: '#E2E2E2', letterSpacing: 1, marginBottom: 18 }}>
          채팅 이름 변경
        </div>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') onCancel() }}
          style={{
            width: '100%', padding: '12px 14px',
            background: '#111', border: '1px solid rgba(255,215,0,0.35)',
            borderRadius: 3, color: '#E2E2E2', fontSize: 14,
            outline: 'none', fontFamily: 'Noto Sans KR, sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            padding: '9px 20px', borderRadius: 2,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          >취소</button>
          <button onClick={confirm} disabled={!draft.trim()} style={{
            padding: '9px 20px', borderRadius: 2,
            background: draft.trim() ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.06)',
            border: 'none', color: draft.trim() ? '#000' : 'rgba(255,255,255,0.3)',
            fontSize: 13, fontWeight: 700, cursor: draft.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}>이름 변경</button>
        </div>
      </div>
    </div>
  )
}

// ─── DeleteModal ──────────────────────────────────────────────────────────────

function DeleteModal({ title, onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1F1F1F', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2, padding: '28px 28px 24px', width: 360,
        boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        animation: 'float-up 0.2s ease',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#E2E2E2', marginBottom: 12 }}>
          상담을 삭제하시겠습니까?
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 22 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>"{title}"</span> 상담의 모든 대화 내용이 삭제되며, 이 작업은 되돌릴 수 없습니다.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{
            padding: '9px 20px', borderRadius: 2,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          >취소</button>
          <button onClick={onConfirm} style={{
            padding: '9px 20px', borderRadius: 2,
            background: 'rgba(244,67,54,0.15)', border: '1px solid rgba(244,67,54,0.4)',
            color: '#F44336', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,67,54,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,67,54,0.15)' }}
          >삭제</button>
        </div>
      </div>
    </div>
  )
}

// ─── SessionItem ──────────────────────────────────────────────────────────────

function SessionItem({ session, isActive, onSelect, onRenameClick, onDeleteClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(session.id)}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: 2,
        background: isActive ? 'rgba(255,215,0,0.08)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: isActive ? '1px solid rgba(255,215,0,0.15)' : '1px solid transparent',
        cursor: 'pointer', textAlign: 'left', marginBottom: 3, transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', gap: 8, boxSizing: 'border-box',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, color: isActive ? '#FFD700' : 'rgba(255,255,255,0.6)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
        }}>
          {session.title}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={10} />{session.date}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}>
        <button
          onClick={e => { e.stopPropagation(); onRenameClick(session) }}
          style={{
            width: 24, height: 24, borderRadius: 2, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <Pencil size={12} color="rgba(255,255,255,0.5)" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDeleteClick(session) }}
          style={{
            width: 24, height: 24, borderRadius: 2, cursor: 'pointer',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,67,54,0.15)'; e.currentTarget.style.borderColor = 'rgba(244,67,54,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <Trash2 size={12} color="rgba(255,255,255,0.5)" />
        </button>
      </div>
    </div>
  )
}

// ─── ConsultPage ──────────────────────────────────────────────────────────────

export default function ConsultPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [authUser, setAuthUser] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [renamingSession, setRenamingSession] = useState(null)
  const [deletingSession, setDeletingSession] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [scrollTargetId, setScrollTargetId] = useState(null)
  const uuid = useRef(getOrCreateDeviceUuid())
  const textareaRef = useRef(null)
  const scrollRef = useRef(null)

  // 사용자 정보 로드
  useEffect(() => {
    getMe()
      .then((u) => setAuthUser(u))
      .catch(() => setAuthUser(null))
  }, [])

  // 새 메시지 전송 시 스크롤 맨 아래로 (paddingBottom 덕에 최신 메시지가 상단에 위치)
  // 세션 목록 로드
  useLayoutEffect(() => {
    if (!scrollTargetId || !scrollRef.current) return
    const target = scrollRef.current.querySelector('[data-scroll-anchor="true"]')
    if (!target) return

    const scroller = scrollRef.current
    const scrollerTop = scroller.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top - scrollerTop + scroller.scrollTop
    scroller.scrollTop = Math.max(0, targetTop - 24)
    setScrollTargetId(null)
  }, [messages, scrollTargetId])

  const loadSessions = () => {
    fetch(`${API_URL}/api/sessions/?device_uuid=${uuid.current}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.length > 0) {
          const list = data.map(s => ({
            id: s.session_id,
            title: s.title,
            date: formatDate(s.created_at),
          }))
          setSessions(list)
          setActiveId(list[0].id)
        } else {
          setSessions([])
          setActiveId(null)
        }
      })
      .catch(() => {})
  }
  // 페이지 진입 시 한번 목록 부르기 위해 함수로 분리해서 호출 
  useEffect(() => { loadSessions() }, [])

  // 로그인 후 인증 유저가 있다면 목록 재호출 
  useEffect(() => {
    if (authUser) {
      loadSessions()
    }
  }, [authUser])

  // 세션 전환 시 메시지 로드
  useEffect(() => {
    if (!activeId || isSending) return
    fetch(`${API_URL}/api/sessions/${activeId}/messages/?device_uuid=${uuid.current}`, {credentials:'include'})
      .then(r => r.json())
      .then(data => {
        setMessages(data.map(m => ({
          id: m.message_id,
          role: m.sender,
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        })))
      })
      .catch(() => setMessages([]))
  }, [activeId, isSending])

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    const maxHeight = 14 * 1.6 * 6 + 8
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }


  const createSession = async () => {
    const res = await fetch(`${API_URL}/api/sessions/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_uuid: uuid.current, title: '새 상담' }),
    })
    const data = await res.json()
    const newSession = { id: data.session_id, title: data.title, date: '방금' }
    setSessions(prev => [newSession, ...prev])
    setActiveId(data.session_id)
    setMessages([])
    setInputValue('')
  }

  const renameSession = async (id, title) => {
    await fetch(`${API_URL}/api/sessions/${id}/`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_uuid: uuid.current, title }),
    })
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }

  const deleteSession = async (id) => {
    await fetch(`${API_URL}/api/sessions/${id}/`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_uuid: uuid.current }),
    })
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (id === activeId) {
        if (next.length > 0) setActiveId(next[0].id)
        else setActiveId(null)
      }
      return next
    })
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return
    const text = inputValue.trim()
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    const title = text.slice(0, 22)

    // ??? ??? ?? ??
    let sessionId = activeId
    if (!sessionId) {
      const res = await fetch(`${API_URL}/api/sessions/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_uuid: uuid.current, title }),
      })
      const data = await res.json()
      sessionId = data.session_id
      setSessions([{ id: sessionId, title, date: '방금' }])
      setActiveId(sessionId)
    } else if (messages.length === 0) {
      renameSession(sessionId, title)
    }

    const tempId = Date.now()
    setScrollTargetId(tempId)
    setMessages(prev => [...prev, { id: tempId, role: 'user', text, time }])
    setInputValue('')
    setIsSending(true)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.overflowY = 'hidden' }

    try {
      const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_uuid: uuid.current, sender: 'user', content: text }),
      })
      if (!res.ok) throw new Error('Failed to send message')

      // SSE 스트리밍 처리
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''
      let finalUserMsgId = null
      let finalBotMsgId = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // 불완전한 마지막 줄 보류

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'token') {
              accumulatedText += event.content
              setStreamingText(accumulatedText)
            } else if (event.type === 'done') {
              finalUserMsgId = event.user_message_id
              finalBotMsgId = event.bot_message_id
            }
          } catch { /* JSON 파싱 실패 무시 */ }
        }
      }

      // 스트리밍 완료 → 메시지 목록 확정
      const botTime = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      setStreamingText('')
      setMessages(prev => {
        const next = prev.map(m =>
          m.id === tempId
            ? { ...m, id: finalUserMsgId || m.id }
            : m
        )
        return [...next, {
          id: finalBotMsgId || `bot-${Date.now()}`,
          role: 'bot',
          text: accumulatedText || '답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          time: botTime,
        }]
      })
    } catch {
      setStreamingText('')
      setMessages(prev => [...prev, {
        id: `${tempId}-error`,
        role: 'bot',
        text: '답변을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      }])
    } finally {
      setIsSending(false)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <>
    <div style={{ height: '100vh', background: '#0F0F0F', display: 'flex', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 280, flexShrink: 0,
        background: '#1F1F1F',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column',
        height: '100%',
        padding: '0 12px',
      }}>
        {/* FITAI 로고 */}
        <div style={{ padding: '24px 8px 16px' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 10px', borderRadius: 2, width: '100%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #FFD700, #C8A200)',
              borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Dumbbell size={17} color="#000" strokeWidth={2.8} />
            </div>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 2, color: '#FFD700' }}>HELBOTIN</span>
          </button>
        </div>

        {/* 새 상담 버튼 */}
        <div style={{ padding: '0 8px 20px' }}>
          <button
            onClick={createSession}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 2,
              background: 'linear-gradient(135deg, #FFD700, #C8A200)',
              border: 'none', color: '#000', fontWeight: 800, fontSize: 13,
              letterSpacing: 0.5, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: '0 4px 20px rgba(255,215,0,0.2)',
              transition: 'all 0.25s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,215,0,0.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,215,0,0.2)'; e.currentTarget.style.transform = 'none' }}
          >
            <MessageSquare size={15} />
            새 상담 시작
          </button>
        </div>

        {/* 세션 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
          <div style={{
            fontSize: 10, letterSpacing: 3,
            color: 'rgba(255,255,255,0.25)',
            padding: '4px 10px 10px',
          }}>
            이전 상담
          </div>
          {sessions.map(s => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === activeId}
              onSelect={id => { setActiveId(id); setInputValue(''); if (textareaRef.current) { textareaRef.current.style.height = 'auto' } }}
              onRenameClick={s => setRenamingSession(s)}
              onDeleteClick={s => setDeletingSession(s)}
            />
          ))}
        </div>

        {/* 유저 프로필 */}
        <div style={{ padding: '12px 8px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => { if (!authUser) navigate('/login') }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 2,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 2,
              background: 'linear-gradient(135deg, #333, #1a1a1a)',
              border: '1px solid rgba(255,215,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 15,
            }}>👤</div>
            <span style={{ fontSize: 13, color: 'rgba(226,226,226,0.75)', fontWeight: 500 }}>
              {authUser ? authUser.nickname : '게스트'}
            </span>
          </button>
        </div>

      </aside>

      {/* ── 메인 채팅 영역 ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0F0F0F', overflow: 'hidden' }}>

        {/* 스크롤 메시지 영역 */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '56px 0 0' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '0 32px 60vh', boxSizing: 'border-box' }}>
            {hasMessages ? (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    data-message-role={msg.role}
                    data-scroll-anchor={msg.id === scrollTargetId ? 'true' : undefined}
                  >
                    <Message msg={msg} />
                  </div>
                ))}
                {isSending && !streamingText && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <BotAvatar />
                    <div style={{
                      padding: '12px 18px',
                      borderRadius: '2px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', gap: 5, alignItems: 'center',
                    }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <span key={i} style={{
                          width: 7, height: 7, borderRadius: 2,
                          background: 'rgba(255,215,0,0.5)',
                          animation: `pulse-glow 1.2s ease-in-out ${delay}s infinite`,
                        }} />
                      ))}
                    </div>
                  </div>
                )}
                {streamingText && (
                  <div style={{ display: 'flex', gap: 14, marginBottom: 56 }}>
                    <BotAvatar />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: 'rgba(226,226,226,0.85)', lineHeight: 1.85 }} className="md-bot">
                        <ReactMarkdown>{streamingText}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100%', minHeight: '55vh',
                background: 'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(255,215,0,0.07) 0%, transparent 70%)',
              }}>
                <h1 style={{
                  fontFamily: 'Bebas Neue',
                  fontSize: 'clamp(28px, 3.5vw, 46px)',
                  color: '#E2E2E2',
                  letterSpacing: 3,
                  textAlign: 'center',
                  fontWeight: 400,
                  margin: 0,
                }}>
                  무엇을 도와드릴까요?
                </h1>
              </div>
            )}
          </div>
        </div>

        {/* 하단 고정 영역 */}
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%', padding: '0 32px', boxSizing: 'border-box' }}>
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap',
            padding: '12px 0 0',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            {QUICK_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => setInputValue(q)}
                style={{
                  padding: '6px 14px', borderRadius: 2,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,215,0,0.25)'; e.currentTarget.style.color = '#FFD700' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
              >
                <ChevronRight size={11} />{q}
              </button>
            ))}
          </div>

          <div style={{ padding: '14px 0 28px' }}>
            <div style={{
              display: 'flex', gap: 12, background: '#1A1A1A', alignItems: 'flex-end',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 2, padding: '10px 10px 10px 20px',
              transition: 'border-color 0.2s',
            }}>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                placeholder="운동 목표, 체력 수준, 통증 부위 등을 자유롭게 말씀해주세요..."
                rows={1}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#E2E2E2', fontSize: 14, resize: 'none', lineHeight: 1.6,
                  padding: '10px 0', fontFamily: 'Noto Sans KR, sans-serif',
                  overflowY: 'hidden', transition: 'height 0.1s ease',
                }}
                onFocus={e => e.target.parentElement.style.borderColor = 'rgba(255,215,0,0.35)'}
                onBlur={e => e.target.parentElement.style.borderColor = 'rgba(255,255,255,0.08)'}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isSending}
                style={{
                  width: 42, height: 42, borderRadius: 2,
                  background: inputValue.trim() && !isSending ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: inputValue.trim() && !isSending ? 'pointer' : 'default',
                  flexShrink: 0, transition: 'all 0.25s',
                  boxShadow: inputValue.trim() && !isSending ? '0 4px 16px rgba(255,215,0,0.25)' : 'none',
                }}
              >
                <Send size={17} color={inputValue.trim() && !isSending ? '#000' : 'rgba(255,255,255,0.2)'} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 10 }}>
              AI 답변은 참고용이며, 부상·통증이 있을 경우 전문의 상담을 권장합니다
            </div>
          </div>
        </div>

      </main>
    </div>

    {renamingSession && (
      <RenameModal
        title={renamingSession.title}
        onConfirm={newTitle => { renameSession(renamingSession.id, newTitle); setRenamingSession(null) }}
        onCancel={() => setRenamingSession(null)}
      />
    )}

    {deletingSession && (
      <DeleteModal
        title={deletingSession.title}
        onConfirm={() => { deleteSession(deletingSession.id); setDeletingSession(null) }}
        onCancel={() => setDeletingSession(null)}
      />
    )}
    </>
  )
}
