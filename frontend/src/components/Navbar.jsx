import { useState, useEffect } from 'react'
import { Dumbbell } from 'lucide-react'

export default function Navbar({ currentPage, onNavigate }) {
    const [scrolled, setScrolled] = useState(false)
    const [hoveredLink, setHoveredLink] = useState(null)

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 60)
        window.addEventListener('scroll', fn, { passive: true })
        return () => window.removeEventListener('scroll', fn)
    }, [])

    const links = [
        { label: '운동 둘러보기', page: 'exercises' },
        { label: '주간 루틴 설계', page: 'routine' },
        { label: '운동 상담', page: 'consult' },
    ]

    const isExercisePage = currentPage === 'exercises'

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            padding: '0 52px',
            height: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: (scrolled || isExercisePage)
                ? 'rgba(5,5,5,0.97)'
                : 'linear-gradient(to bottom, rgba(5,5,5,0.82) 0%, transparent 100%)',
            backdropFilter: (scrolled || isExercisePage) ? 'blur(20px) saturate(1.5)' : 'none',
            borderBottom: (scrolled || isExercisePage) ? '1px solid rgba(255,215,0,0.07)' : 'none',
            transition: 'background 0.45s ease, border-bottom 0.45s ease, backdrop-filter 0.45s ease',
        }}>
            {/* Logo */}
            <button
                onClick={() => onNavigate('home')}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
            >
                <div
                    style={{
                        width: 36, height: 36,
                        background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                        borderRadius: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 18px rgba(255,215,0,0.18)',
                        transition: 'box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = '0 0 32px rgba(255,215,0,0.5)'
                        e.currentTarget.style.transform = 'scale(1.06)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = '0 0 18px rgba(255,215,0,0.18)'
                        e.currentTarget.style.transform = 'none'
                    }}
                >
                    <Dumbbell size={19} color="#000" strokeWidth={2.8} />
                </div>
                <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 5, color: '#FFD700' }}>FitAI</span>
            </button>

            {/* Nav links */}
            <div style={{ display: 'flex', gap: 38, alignItems: 'center' }}>
                {links.map(({ label, page }) => {
                    const isActive = page && currentPage === page
                    const showUnderline = isActive || hoveredLink === label
                    return (
                        <button
                            key={label}
                            onClick={() => page && onNavigate(page)}
                            onMouseEnter={() => { if (page) setHoveredLink(label) }}
                            onMouseLeave={() => setHoveredLink(null)}
                            style={{
                                background: 'none', border: 'none',
                                fontSize: 13, fontWeight: 500,
                                color: isActive ? '#FFD700' : hoveredLink === label ? '#FFD700' : 'rgba(255,255,255,0.5)',
                                letterSpacing: 0.5,
                                cursor: page ? 'pointer' : 'default',
                                transition: 'color 0.2s ease',
                                padding: '6px 0',
                                position: 'relative',
                            }}
                        >
                            {label}
                            {/* 슬라이드 언더라인 */}
                            <span style={{
                                position: 'absolute', bottom: 0, left: 0,
                                width: showUnderline ? '100%' : '0%',
                                height: 1.5,
                                background: 'linear-gradient(90deg, #FFD700, #C8A200)',
                                borderRadius: 1,
                                transition: 'width 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                            }} />
                        </button>
                    )
                })}
            </div>

            {/* 로그인 + CTA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <button
                    style={{
                        background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                        color: '#000', fontWeight: 800, fontSize: 12,
                        padding: '10px 22px', borderRadius: 5,
                        letterSpacing: 1,
                        boxShadow: '0 2px 18px rgba(255,215,0,0.22)',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = '0 6px 30px rgba(255,215,0,0.48)'
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = '0 2px 18px rgba(255,215,0,0.22)'
                        e.currentTarget.style.transform = 'none'
                    }}
                >로그인</button>
            </div>
        </nav>
    )
}
