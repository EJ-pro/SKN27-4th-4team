import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getMe, logout } from '../api/auth'
import BrandIcon from './BrandIcon'

const links = [
    { label: '운동 백과', to: '/exercise' },
    { label: '주간 루틴', to: '/routine' },
    { label: '운동 상담', to: '/consult' },
]

export default function Navbar() {
    const [user, setUser] = useState(null)
    const [scrolled, setScrolled] = useState(false)
    const [hoveredLink, setHoveredLink] = useState(null)
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const isExercisePage = pathname === '/exercise'

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 60)
        window.addEventListener('scroll', fn, { passive: true })
        fn()
        return () => window.removeEventListener('scroll', fn)
    }, [])

    useEffect(() => {
        getMe()
            .then(setUser)
            .catch(() => setUser(null))
    }, [])

    const handleLogout = async () => {
        await logout()
        setUser(null)
        navigate('/')
    }

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
            <Link
                to="/"
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    textDecoration: 'none',
                }}
            >
                <BrandIcon
                    size={36}
                    style={{
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
                />
                <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 2, color: '#FFD700' }}>HELBOTIN</span>
            </Link>

            <div style={{ display: 'flex', gap: 38, alignItems: 'center' }}>
                {links.map(({ label, to }) => (
                    <NavLink
                        key={to}
                        to={to}
                        onMouseEnter={() => setHoveredLink(label)}
                        onMouseLeave={() => setHoveredLink(null)}
                        style={({ isActive }) => ({
                            background: 'none', border: 'none',
                            fontSize: 15, fontWeight: 500,
                            color: isActive ? '#FFD700' : hoveredLink === label ? '#FFD700' : 'rgba(255, 255, 255, 0.884)',
                            letterSpacing: 0.5,
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                            padding: '6px 0',
                            position: 'relative',
                            textDecoration: 'none',
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                {label}
                                <span style={{
                                    position: 'absolute', bottom: 0, left: 0,
                                    width: (isActive || hoveredLink === label) ? '100%' : '0%',
                                    height: 1.5,
                                    background: 'linear-gradient(90deg, #FFD700, #C8A200)',
                                    borderRadius: 1,
                                    transition: 'width 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                                }} />
                            </>
                        )}
                    </NavLink>
                ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {user ? (
                    <>
                        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
                            {user.nickname}님
                        </span>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'rgba(255,215,0,0.1)',
                                border: '1px solid rgba(255,215,0,0.35)',
                                color: '#FFD700', fontWeight: 700, fontSize: 15,
                                padding: '10px 20px', borderRadius: 2,
                                letterSpacing: 1,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.18)'
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.1)'
                                e.currentTarget.style.transform = 'none'
                            }}
                        >
                            로그아웃
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                                color: '#111111', fontWeight: 800, fontSize: 15,
                                padding: '10px 20px', borderRadius: 2,
                                letterSpacing: 1,
                                boxShadow: '0 2px 18px #111111',
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.boxShadow = '0 6px 30px rgba(255,215,0,0.48)'
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.boxShadow = '0 2px 18px #111111'
                                e.currentTarget.style.transform = 'none'
                            }}
                        >
                            로그인
                        </button>
                        <button
                            onClick={() => navigate('/register')}
                            style={{
                                background: 'rgba(255,215,0,0.1)',
                                border: '1px solid rgba(255,215,0,0.35)',
                                color: '#FFD700', fontWeight: 700, fontSize: 15,
                                padding: '10px 20px', borderRadius: 2,
                                letterSpacing: 1,
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.18)'
                                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,215,0,0.1)'
                                e.currentTarget.style.transform = 'none'
                            }}
                        >
                            회원가입
                        </button>
                    </>
                )}
            </div>
        </nav>
    )
}
