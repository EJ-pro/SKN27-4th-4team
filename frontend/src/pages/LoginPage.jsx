import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, LogIn, Mail } from 'lucide-react'
import BrandIcon from '../components/BrandIcon'
import { login } from '../api/auth'
import { getOrCreateDeviceUuid } from '../utils/deviceUuid'
import './Auth.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({
        email,
        password,
        device_uuid: getOrCreateDeviceUuid(),
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-brand" to="/" aria-label="HELBOTIN 홈으로 이동">
        <BrandIcon size={36} style={{ boxShadow: '0 0 22px rgba(255, 215, 0, 0.22)' }} />
        <span>HELBOTIN</span>
      </Link>

      <section className="auth-shell" aria-labelledby="login-title">
        <div className="auth-copy">
          <span className="auth-kicker">MEMBER ACCESS</span>
          <h1 id="login-title">로그인</h1>
          <p>운동 상담과 주간 루틴 기록을 이어가세요.</p>
          <div className="auth-rule" />
        </div>

        <form className="auth-panel" onSubmit={handleLogin}>
          {error && <p className="auth-error">{error}</p>}

          <label className="auth-field" htmlFor="email">
            <span>이메일</span>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일 입력"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="auth-field" htmlFor="password">
            <span>비밀번호</span>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            <LogIn size={17} />
            {loading ? '진행 중...' : '로그인'}
          </button>

          <div className="auth-actions">
            <button type="button" onClick={() => navigate('/register')}>
              회원가입
            </button>
            <button type="button" onClick={() => navigate('/')}>
              <ArrowLeft size={14} />
              돌아가기
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
