import { useEffect, useState } from 'react'
import { ChevronDown, Zap, ArrowRight } from 'lucide-react'

export default function Hero() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      overflow: 'hidden',
      background: '#050505',
    }}>
      {/* 좌측 텍스트 뒤 Ambient warm glow */}
      <div style={{
        position: 'absolute',
        top: '15%', left: '-20%',
        width: 750, height: 750,
        background: 'radial-gradient(circle, rgba(255,165,0,0.055) 0%, transparent 65%)',
        zIndex: 1, pointerEvents: 'none',
      }} />

      {/* Left: copy */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '140px 60px 80px 72px',
        zIndex: 2,
      }}>
        {/* 상단 Gold accent stroke (너비 애니메이션) */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: visible ? '58%' : 0,
          height: 3,
          background: 'linear-gradient(90deg, #FFD700, #FF7C35, transparent)',
          transition: 'width 1.3s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
          borderRadius: '0 2px 2px 0',
        }} />

        {/* Headline line 1 */}
        <h1 style={{
          fontFamily: 'Bebas Neue',
          fontSize: 'clamp(56px, 6.4vw, 80px)',
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.15,
          marginBottom: 10,
          letterSpacing: 3,
          whiteSpace: 'nowrap',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-32px)',
          transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s',
        }}>
          같은 부위, 다른 자극
        </h1>

        {/* Headline line 2 — gold gradient */}
        <h1 style={{
          fontFamily: 'Bebas Neue',
          fontSize: 'clamp(56px, 6.4vw, 80px)',
          lineHeight: 1.15,
          paddingTop: '6px',
          paddingBottom: '6px',
          marginBottom: 10,
          letterSpacing: 3,
          whiteSpace: 'nowrap',
          background: 'linear-gradient(135deg, #FFE566 10%, #FFD700 42%, #B59000 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 32px rgba(255,200,0,0.38))',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-32px)',
          transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.22s',
        }}>
          뻔한 루틴을 깨다.
        </h1>

        {/* Description */}
        <p style={{
          fontSize: 14.5, color: 'rgba(255, 255, 255, 0.726)',
          lineHeight: 2.05, marginBottom: 50, marginLeft: 20,
          fontWeight: 300, letterSpacing: 0.2,
          opacity: visible ? 1 : 0,
          transition: 'all 0.7s ease 0.36s',
        }}>
          몸이 익숙해진 운동은 성장을 멈춥니다.<br />
          매주 신선한 자극을 줄 수 있는 루틴을 만들어 보세요.
        </p>

        {/* CTA Buttons + Trust row */}
        <div style={{
          opacity: visible ? 1 : 0,
          transition: 'all 0.7s ease 0.46s',
        }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {/* Primary CTA */}
            <button
              style={{
                background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                color: '#000', fontWeight: 800, fontSize: 15,
                padding: '16px 40px', borderRadius: 2,
                letterSpacing: 0.8,
                boxShadow: '0 4px 32px rgba(255,215,0,0.28), 0 2px 8px rgba(0,0,0,0.4)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'
                e.currentTarget.style.boxShadow = '0 12px 48px rgba(255,215,0,0.5), 0 4px 12px rgba(0,0,0,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 4px 32px rgba(255,215,0,0.28), 0 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              HELBOTIN 시작하기
            </button>

            {/* Secondary CTA */}
            <button
              style={{
                background: '#111111',
                color: '#F1F3F5', fontWeight: 600, fontSize: 15,
                padding: '16px 32px', borderRadius: 2,
                border: '2px solid #F1F3F5',
                transition: 'all 0.25s ease',
                letterSpacing: 0.4,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#F1F3F5'
                e.currentTarget.style.borderColor = '#F1F3F5'
                e.currentTarget.style.color = '#111111'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#111111'
                e.currentTarget.style.borderColor = '#F1F3F5'
                e.currentTarget.style.color = '#F1F3F5'
              }}
            >운동 백과</button>
          </div>
        </div>
      </div>

      {/* Right: large image */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease 0.15s',
      }}>
        <img
          src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1000&q=90"
          alt="workout"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            display: 'block',
            animation: visible ? 'ken-burns 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards' : 'none',
          }}
        />

        {/* 다층 오버레이 */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(to right, #050505 0%, rgba(5,5,5,0.55) 26%, transparent 55%),
            linear-gradient(to top, rgba(5,5,5,0.88) 0%, transparent 44%),
            linear-gradient(to bottom, rgba(5,5,5,0.28) 0%, transparent 18%)
          `,
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.38) 100%)',
        }} />

        {/* 상단 골드 accent 라인 */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, rgba(255,215,0,0.15), #FFD700 40%, rgba(255,215,0,0.15))',
          opacity: 0.55,
        }} />

        {/* Vertical "ROUTINE" watermark */}
        <div style={{
          position: 'absolute', right: 22, top: '50%',
          transform: 'translateY(-50%) rotate(90deg)',
          fontFamily: 'Bebas Neue', fontSize: 66,
          letterSpacing: 20, color: 'rgba(255,255,255,0.035)',
          userSelect: 'none', whiteSpace: 'nowrap',
        }}>ROUTINE</div>

        {/* Stats overlay — glassmorphism */}
        <div style={{
          position: 'absolute', bottom: 40, right: 36,
          display: 'flex', gap: 12,
        }}>
          {[
            { val: '900+', label: '운동 데이터' },
            { val: '365일', label: '새로운 자극' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(5,5,5,0.6)',
              border: '2px solid #FFD700',
              borderRadius: 3,
              padding: '15px 22px',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'Bebas Neue', fontSize: 32, color: '#FFD700',
                lineHeight: 1, filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.55))',
              }}>{s.val}</div>
              <div style={{
                fontSize: 12, color: 'rgb(255, 255, 255)',
                marginTop: 5, letterSpacing: 1.5,
              }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        opacity: visible ? 0.85 : 0,
        transition: 'opacity 1.2s ease 1.3s',
        zIndex: 3,
        animation: visible ? 'scroll-bounce 2.4s ease-in-out 1.5s infinite' : 'none',
      }}>
        <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 5, color: 'rgba(255,255,255,0.7)' }}>SCROLL</span>
        <ChevronDown size={16} color="#FFD700" />
      </div>
    </section>
  )
}
