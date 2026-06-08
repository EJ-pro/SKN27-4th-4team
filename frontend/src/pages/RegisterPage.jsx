import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Lock, Mail, User, UserPlus } from 'lucide-react'
import { register } from '../api/auth'
import './Auth.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({
        nickname: userId,
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

  return (
    <main className="auth-page">
      <Link className="auth-brand" to="/" aria-label="HELBOTIN 홈으로 이동">
        <span className="auth-brand-mark">
          <Dumbbell size={18} color="#000" strokeWidth={2.8} />
        </span>
        <span>HELBOTIN</span>
      </Link>

      <section className="auth-shell" aria-labelledby="register-title">
        <div className="auth-copy">
          <span className="auth-kicker">WELCOME HELBOTIN</span>
          <h1 id="register-title">회원가입</h1>
          <p>새로운 시작을 함께해요</p>
          <div className="auth-rule" />
        </div>

        <form className="auth-panel" onSubmit={handleRegister}>
          {error && <p className="auth-error">{error}</p>}

          <label className="auth-field" htmlFor="user_id">
            <span>아이디</span>
            <div className="auth-input-wrap auth-input-wrap-action">
              <User size={16} />
              <input
                id="user_id"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="아이디 입력"
                autoComplete="username"
                required
              />
              <button className="auth-check-button" type="button">
                중복체크
              </button>
            </div>
          </label>

          <label className="auth-field" htmlFor="email">
            <span>이메일</span>
            <div className="auth-input-wrap auth-input-wrap-action">
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
              <button className="auth-check-button" type="button">
                중복체크
              </button>
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
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          <label className="auth-field" htmlFor="password_confirm">
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="password_confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
              />
            </div>
          </label>

          <button className="auth-submit" type="submit" disabled={loading}>
            <UserPlus size={17} />
            {loading ? '진행 중...' : '가입하기'}
          </button>

          <div className="auth-actions">
            <button type="button" onClick={() => navigate('/login')}>
              로그인으로 이동
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
