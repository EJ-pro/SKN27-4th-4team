import { useState, useEffect, useRef } from 'react'
import { Sparkles, Send, MessageSquare, SlidersHorizontal, MousePointerClick } from 'lucide-react'

const QUICK_BTNS = ['초보자 시작 방법', '어깨 통증 대체 운동', '허리 안 아픈 스쿼트', '손목 보호 운동']

const CHAT_SCRIPT = [
  {
    role: 'user',
    text: '벤치프레스할 때 어깨가 너무 아픈데 회전근개 문제일까? 대체할 수 있는 가슴 운동도 추천해 줘.',
    delay: 0
  },
  {
    role: 'ai',
    text: '벤치프레스 시 어깨 통증은 회전근개(특히 극상근)의 충돌 증후군이나 전면 삼각근의 과개입 때문일 가능성이 높습니다. 바벨이 바닥과 수직을 이루고 있는지, 혹은 이완 시 어깨가 으쓱하며 솟지 않는지 점검해 보세요.\n\n어깨 부담을 줄이면서 가슴을 안전하게 타겟팅할 수 있는 대체 운동을 추천해 드립니다.\n\n1. 덤벨 프레스: 바벨과 달리 손목 각도를 자유롭게 조절할 수 있어 어깨 관절의 스트레스를 줄여줍니다.\n2. 패러렐 그립 푸쉬업: 평행 바를 활용해 전거근의 자연스러운 개입을 유도하고 어깨 충돌을 방지합니다.',
    delay: 1500
  },
  {
    role: 'user',
    text: '덤벨 프레스 할 때 덤벨을 쥐는 각도는 어떻게 하는 게 좋아?',
    delay: 3000
  },
  {
    role: 'ai',
    text: '덤벨을 완전히 수평 일자(ㅡ ㅡ)로 두기보다는, 위에서 내려다봤을 때 화살표 모양(↖ ↗)이 되도록 약 15~30도 정도 안쪽으로 비스듬히 돌려 잡는 것이 좋습니다.\n\n이 각도는 견갑골의 자연스러운 동작 각도(견갑골 면)와 일치하여 어깨 관절 구멍(관절와순) 내에서 상완골 머리가 충돌하는 것을 예방하고, 회전근개의 스트레스를 최소화해 줍니다.',
    delay: 4500
  },
  {
    role: 'user',
    text: '허리가 안 좋은데 스쿼트 대신할 하체 운동도 있을까?',
    delay: 6000
  },
  {
    role: 'ai',
    text: '척추에 수직 압박(축성 부하)이 많이 가해지는 백 스쿼트 대신, 허리 부담이 현저히 적으면서도 하체를 강하게 단련할 수 있는 운동들을 추천합니다.\n\n1. 레그 프레스: 시트에 등을 대어 척추를 지탱한 상태에서 대퇴사두근과 둔근을 고립해서 훈련할 수 있습니다.\n2. 레그 익스텐션 & 컬: 관절을 구부리고 펴는 단순 관절 운동으로 허리 척추 기립근에 가는 부담이 거의 없습니다.\n3. 스플릿 스쿼트 (덤벨): 몸을 한 다리씩 지탱하여 척추에 얹어지는 무거운 바벨 무게 없이도 하체에 큰 부하를 줄 수 있습니다.',
    delay: 7500
  }
]

function TypingDots() {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: '12px 14px', background: '#1C1C1C',
      borderRadius: '4px 4px 4px 1px', border: '1px solid rgba(255,255,255,0.06)',
      width: 'fit-content', alignItems: 'center'
    }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,215,0,0.5)',
          display: 'inline-block',
          animation: `pulse-glow 1.3s ease ${i * 0.22}s infinite`,
        }} />
      ))}
    </div>
  )
}

export default function ChatSection() {
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [input, setInput] = useState('')
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const chatContainerRef = useRef()
  const sectionRef = useRef()

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.2 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  // Auto-start demo when visible
  useEffect(() => {
    if (visible && !started) {
      setStarted(true)
    }
  }, [visible, started])

  useEffect(() => {
    if (!started || msgIdx >= CHAT_SCRIPT.length) return
    const msg = CHAT_SCRIPT[msgIdx]
    const showTyping = msg.role === 'ai' && msgIdx > 0

    const timer = setTimeout(() => {
      if (showTyping) {
        setTyping(true)
        setTimeout(() => {
          setTyping(false)
          setMessages(prev => [...prev, msg])
          setMsgIdx(i => i + 1)
        }, 900)
      } else {
        setMessages(prev => [...prev, msg])
        setMsgIdx(i => i + 1)
      }
    }, msg.delay)

    return () => clearTimeout(timer)
  }, [started, msgIdx])

  useEffect(() => {
    const el = chatContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing])

  const handleQuick = (val) => setInput(prev => prev ? prev + ' ' + val : val)

  return (
    <section ref={sectionRef} style={{
      position: 'relative',
      background: 'linear-gradient(160deg, #0D0800 0%, #100A00 40%, #0A0A0A 100%)',
      padding: '100px 48px',
      overflow: 'hidden',
    }}>
      {/* 배경: AI 시각화 */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `url('https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1600&q=40')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: 0.04, filter: 'saturate(0)',
      }} />
      {/* 중앙 gold 라디얼 글로우 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 900, height: 600, zIndex: 0,
        background: 'radial-gradient(ellipse, rgba(255,180,0,0.05) 0%, transparent 65%)',
      }} />
      {/* 우측 채팅창 뒤 빛 */}
      <div style={{
        position: 'absolute', top: '20%', right: '5%', zIndex: 0,
        width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 65%)',
      }} />
      {/* 상단 accent 라인 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 0,
        background: 'linear-gradient(90deg, transparent 0%, #FFD700 50%, #FF6B35 80%, transparent 100%)',
        opacity: 0.4,
      }} />
      <div style={{
        maxWidth: 1300, margin: '0 auto', position: 'relative', zIndex: 1,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 70, alignItems: 'center'
      }}>

        {/* Left: copy */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-30px)',
          transition: 'all 0.8s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 24, height: 2, background: '#FFD700', borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 5.5, color: '#FFD700', opacity: 0.85 }}>
              FITNESS ENCYCLOPEDIA
            </span>
          </div>
          <h2 style={{
            fontFamily: 'Bebas Neue', fontSize: 'clamp(42px, 5.5vw, 70px)',
            color: '#FFF', lineHeight: 1.02, marginBottom: 20,
          }}>
            대화로 찾아내는<br />
            <span className="gold-text">운동 백과</span>
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 2, marginBottom: 36 }}>
            검증된 운동 데이터를 기반으로 답변하는 AI 운동 백과사전.<br />
            정확한 타겟 부위부터 부상 방지를 위한 대체 운동까지,<br />
            흩어진 지식을 한눈에 찾아 드립니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
            {[
              { Icon: MessageSquare, color: '#FFD700', text: '검증된 데이터 기반 답변' },
              { Icon: SlidersHorizontal, color: '#7C72FF', text: '내 몸의 컨디션에 맞춘 대체 운동 매칭' },
              { Icon: MousePointerClick, color: '#00D4A0', text: '해부학적 타겟 부위 및 자세 가이드' },
            ].map(({ Icon, color, text }) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 3,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 3,
                  background: `${color}14`,
                  border: `1px solid ${color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={15} color={color} strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)' }}>{text}</span>
              </div>
            ))}
          </div>

          <button style={{
            background: 'linear-gradient(135deg, #FFD700, #C8A200)',
            color: '#000', fontWeight: 800, fontSize: 13,
            padding: '14px 36px', borderRadius: 3, letterSpacing: 1.5,
            boxShadow: '0 4px 24px rgba(255,215,0,0.25)',
            transition: 'all 0.25s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 36px rgba(255,215,0,0.4)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,215,0,0.25)' }}
          >
            운동 백과사전 검색하기
          </button>
        </div>

        {/* Right: chat UI */}
        <div style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(30px)',
          transition: 'all 0.8s ease 0.15s',
        }}>
          <div style={{
            background: '#0C0C0C',
            border: '1px solid rgba(255,215,0,0.14)',
            borderRadius: 4,
            overflow: 'hidden',
            boxShadow: '0 48px 96px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
          }}>
            {/* Chat header */}
            <div style={{
              background: 'linear-gradient(135deg, #131100, #121212)',
              padding: '15px 20px',
              borderBottom: '1px solid rgba(255,215,0,0.09)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38,
                background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                borderRadius: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 14px rgba(255,215,0,0.3)',
              }}>
                <Sparkles size={18} color="#000" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#FFF' }}>운동 백과사전</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#4CAF50', marginTop: 1 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#4CAF50',
                    boxShadow: '0 0 5px #4CAF50', display: 'inline-block'
                  }} />
                  온라인
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={chatContainerRef}
              style={{
                height: 340, overflowY: 'auto', padding: '18px 18px 10px',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'float-up 0.3s ease',
                }}>
                  {msg.role === 'ai' && (
                    <div style={{
                      width: 26, height: 26,
                      background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                      borderRadius: 3, flexShrink: 0, alignSelf: 'flex-end', marginRight: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Sparkles size={12} color="#000" />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '78%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '4px 4px 1px 4px' : '4px 4px 4px 1px',
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #FFD700, #C8A200)'
                      : '#1A1A1A',
                    color: msg.role === 'user' ? '#000' : 'rgba(255,255,255,0.82)',
                    fontSize: 12.5, lineHeight: 1.75,
                    fontWeight: msg.role === 'user' ? 600 : 400,
                    border: msg.role === 'ai' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    boxShadow: msg.role === 'user'
                      ? '0 4px 18px rgba(255,215,0,0.2)'
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    whiteSpace: 'pre-line',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26,
                    background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                    borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Sparkles size={12} color="#000" />
                  </div>
                  <TypingDots />
                </div>
              )}
            </div>

            {/* Quick buttons */}
            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              {QUICK_BTNS.map(btn => (
                <button key={btn} onClick={() => handleQuick(btn)} style={{
                  padding: '4px 12px', borderRadius: 2, fontSize: 11, cursor: 'pointer',
                  background: 'rgba(255,215,0,0.07)',
                  border: '1px solid rgba(255,215,0,0.2)',
                  color: 'rgba(255,215,0,0.8)', fontWeight: 600,
                  transition: 'all 0.18s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,215,0,0.07)' }}
                >{btn}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 14px 14px',
              display: 'flex', gap: 10, alignItems: 'center',
              background: '#0A0A0A',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="운동 목표나 조건을 말씀해주세요..."
                style={{
                  flex: 1, background: '#141414',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 4, padding: '11px 18px',
                  color: '#FFF', fontSize: 12.5,
                  outline: 'none',
                  transition: 'border-color 0.22s ease',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,215,0,0.38)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.09)'}
              />
              <button
                style={{
                  width: 40, height: 40,
                  background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                  borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(255,215,0,0.3)',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.1)'
                  e.currentTarget.style.boxShadow = '0 6px 24px rgba(255,215,0,0.5)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,215,0,0.3)'
                }}
              >
                <Send size={15} color="#000" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
