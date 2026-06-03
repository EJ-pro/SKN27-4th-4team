import { useState, useRef, useEffect } from 'react'
import { Send, Dumbbell, ChevronRight, Clock, MessageSquare, Pencil, Trash2 } from 'lucide-react'

// ─── 초기 데이터 ──────────────────────────────────────────────────────────────

const INITIAL_MESSAGES = [
  {
    id: 1, role: 'bot',
    text: '안녕하세요! 저는 AI 운동 코치입니다 💪\n\n운동 목표, 현재 체력 수준, 통증 부위 등을 알려주시면 맞춤형 루틴을 설계해드릴게요.\n\n어떤 도움이 필요하신가요?',
    time: '오후 2:30',
  },
  {
    id: 2, role: 'user',
    text: '어깨 통증이 있는데 운동해도 될까요? 왼쪽 어깨가 들어올릴 때 아파요.',
    time: '오후 2:31',
  },
  {
    id: 3, role: 'bot',
    text: '어깨 통증이 있으실 때는 우선 통증 원인을 파악하는 것이 중요합니다.\n\n• 통증 지속 기간: 언제부터 시작됐나요?\n• 통증 강도: 1~10 사이로 표현하면?\n• 특정 동작에서 악화되나요?\n\n정확한 진단 전까지는 무거운 오버헤드 동작은 피하시는 것이 좋습니다.',
    time: '오후 2:31',
  },
]

const INITIAL_SESSIONS = [
  { id: 1, title: '어깨 통증이 있는데 어떤 운동...', date: '오늘', messages: INITIAL_MESSAGES },
  { id: 2, title: '하체 루틴 3일 추천해줘', date: '어제', messages: [] },
  { id: 3, title: '벤치프레스 100kg 목표 루틴', date: '3일 전', messages: [] },
  { id: 4, title: '초보자 전신 루틴 짜줘', date: '1주 전', messages: [] },
]

const QUICK_QUESTIONS = [
  '오늘 운동 추천',
  '통증 있어도 가능한 운동',
  '초보자 시작 방법',
]

// ─── BotAvatar ────────────────────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: 'linear-gradient(135deg, #FFD700, #C8A200)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 14px rgba(255,215,0,0.25)',
    }}>
      <Dumbbell size={18} color="#000" strokeWidth={2.8} />
    </div>
  )
}

// ─── Message ──────────────────────────────────────────────────────────────────

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div style={{
      display: 'flex',
      flexDirection: isBot ? 'row' : 'row-reverse',
      gap: 12,
      marginBottom: 20,
      animation: 'float-up 0.3s ease',
    }}>
      {isBot && <BotAvatar />}
      <div style={{ maxWidth: '72%' }}>
        <div style={{
          padding: '14px 18px',
          borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          background: isBot
            ? 'rgba(255,255,255,0.05)'
            : 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(200,162,0,0.1))',
          border: isBot
            ? '1px solid rgba(255,255,255,0.07)'
            : '1px solid rgba(255,215,0,0.2)',
          fontSize: 14,
          color: isBot ? 'rgba(255,255,255,0.82)' : '#fff',
          lineHeight: 1.75,
          whiteSpace: 'pre-line',
        }}>
          {msg.text}
        </div>
        <div style={{
          fontSize: 11, color: 'rgba(255,255,255,0.22)',
          marginTop: 5,
          textAlign: isBot ? 'left' : 'right',
          paddingLeft: isBot ? 4 : 0,
          paddingRight: isBot ? 0 : 4,
        }}>
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
        borderRadius: 16, padding: '28px 28px 24px', width: 380,
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
            borderRadius: 9, color: '#E2E2E2', fontSize: 14,
            outline: 'none', fontFamily: 'Noto Sans KR, sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{
            padding: '9px 20px', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          >취소</button>
          <button onClick={confirm} disabled={!draft.trim()} style={{
            padding: '9px 20px', borderRadius: 8,
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
        borderRadius: 16, padding: '28px 28px 24px', width: 360,
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
            padding: '9px 20px', borderRadius: 8,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
          >취소</button>
          <button onClick={onConfirm} style={{
            padding: '9px 20px', borderRadius: 8,
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
        width: '100%', padding: '10px 12px', borderRadius: 8,
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
            width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
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
            width: 24, height: 24, borderRadius: 5, cursor: 'pointer',
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

export default function ConsultPage({ onNavigate }) {
  const [sessions, setSessions] = useState(INITIAL_SESSIONS)
  const [activeId, setActiveId] = useState(1)
  const [inputValue, setInputValue] = useState('')
  const [renamingSession, setRenamingSession] = useState(null)
  const [deletingSession, setDeletingSession] = useState(null)
  const nextId = useRef(100)
  const textareaRef = useRef(null)

  const handleInputChange = (e) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    const lineHeight = 14 * 1.6
    const maxHeight = lineHeight * 6 + 8
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  const activeSession = sessions.find(s => s.id === activeId) ?? sessions[0]

  const createSession = () => {
    const id = nextId.current++
    const newSession = { id, title: '새 상담', date: '방금', messages: [] }
    setSessions(prev => [newSession, ...prev])
    setActiveId(id)
    setInputValue('')
  }

  const renameSession = (id, title) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }

  const deleteSession = (id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id)
      if (next.length === 0) {
        const fallback = { id: nextId.current++, title: '새 상담', date: '방금', messages: [] }
        setActiveId(fallback.id)
        return [fallback]
      }
      if (id === activeId) setActiveId(next[0].id)
      return next
    })
  }

  const hasMessages = activeSession?.messages?.length > 0

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
            onClick={() => onNavigate('home')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 10px', borderRadius: 10, width: '100%',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, #FFD700, #C8A200)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Dumbbell size={17} color="#000" strokeWidth={2.8} />
            </div>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 5, color: '#FFD700' }}>FitAI</span>
          </button>
        </div>

        {/* 새 상담 버튼 */}
        <div style={{ padding: '0 8px 20px' }}>
          <button
            onClick={createSession}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10,
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #333, #1a1a1a)',
              border: '1px solid rgba(255,215,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 15,
            }}>👤</div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(226,226,226,0.8)', fontWeight: 600 }}>게스트</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>초급 · 로그인 필요</div>
            </div>
          </div>
        </div>

      </aside>

      {/* ── 메인 채팅 영역 ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#0F0F0F', overflow: 'hidden' }}>

        {/* 스크롤 메시지 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 0' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '0 32px', boxSizing: 'border-box' }}>
            {hasMessages ? (
              <>
                {activeSession.messages.map(msg => (
                  <Message key={msg.id} msg={msg} />
                ))}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                  <BotAvatar />
                  <div style={{
                    padding: '12px 18px',
                    borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', gap: 5, alignItems: 'center',
                  }}>
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'rgba(255,215,0,0.5)',
                        animation: `pulse-glow 1.2s ease-in-out ${delay}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                minHeight: '50vh', gap: 16,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 32px rgba(255,215,0,0.2)',
                }}>
                  <Dumbbell size={32} color="#000" strokeWidth={2.5} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Bebas Neue', fontSize: 28, color: '#E2E2E2', letterSpacing: 2, marginBottom: 8 }}>
                    AI 운동 코치
                  </div>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, maxWidth: 360 }}>
                    운동 목표, 체력 수준, 통증 부위 등을 알려주시면<br />맞춤형 루틴을 설계해드릴게요.
                  </p>
                </div>
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
                  padding: '6px 14px', borderRadius: 50,
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
              borderRadius: 16, padding: '10px 10px 10px 20px',
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
              />
              <button
                disabled={!inputValue.trim()}
                style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: inputValue.trim() ? 'linear-gradient(135deg, #FFD700, #C8A200)' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: inputValue.trim() ? 'pointer' : 'default',
                  flexShrink: 0, transition: 'all 0.25s',
                  boxShadow: inputValue.trim() ? '0 4px 16px rgba(255,215,0,0.25)' : 'none',
                }}
              >
                <Send size={17} color={inputValue.trim() ? '#000' : 'rgba(255,255,255,0.2)'} />
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
