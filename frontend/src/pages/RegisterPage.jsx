import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../api/auth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({
        nickname: userId,   // 아이디 → nickname
        email,
        password,
      })
      navigate('/login')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,215,0,0.2)',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block',
    textAlign: 'left',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 6,
  }

  const buttonStyle = {
    width: '100%',
    padding: '10px 24px',
    borderRadius: 8,
    background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.2)',
    color: '#FFD700',
    fontSize: 13,
    cursor: 'pointer',
  }

  return (
    <div style={{
      height: '100vh', background: '#0F0F0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 320, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: '#FFD700', letterSpacing: 4, marginBottom: 24 }}>
          회원가입
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <p style={{ color: '#ff6b6b', fontSize: 13, margin: 0}}>{error}</p>
          )}
          <div>
            <label htmlFor="user_id" style={labelStyle}>아이디</label>
            <input
              id="user_id"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={inputStyle}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? '진행 중...' : '가입'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            style={buttonStyle}
          >
            돌아가기
          </button>
        </form>
      </div>
    </div>
  )
}
