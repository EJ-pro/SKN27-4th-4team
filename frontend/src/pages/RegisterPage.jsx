import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Lock, Mail, User, UserPlus } from 'lucide-react'
import { register, checkNickname, checkEmail } from '../api/auth'
import './Auth.css'

const CHECK = {
  idle: 'idle',
  checking: 'checking',
  available: 'available',
  unavailable: 'unavailable',
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [nicknameCheck, setNicknameCheck] = useState(CHECK.idle)
  const [emailCheck, setEmailCheck] = useState(CHECK.idle)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCheckNickname = async () => {
    setError('')
    setNicknameCheck(CHECK.checking)
    try {
      const { available } = await checkNickname(nickname)
      setNicknameCheck(available ? CHECK.available : CHECK.unavailable)
    } catch (err) {
      setError(err.message)
      setNicknameCheck(CHECK.idle)
    }
  }

  const handleCheckEmail = async () => {
    setError('')
    setEmailCheck(CHECK.checking)
    try {
      const { available } = await checkEmail(email)
      setEmailCheck(available ? CHECK.available : CHECK.unavailable)
    } catch (err) {
      setError(err.message)
      setEmailCheck(CHECK.idle)
    }
  }

  const passwordsMatch = password.length > 0 && password === passwordConfirm
  const canSubmit =
    !loading &&
    passwordsMatch &&
    nicknameCheck === CHECK.available &&
    emailCheck === CHECK.available

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (nicknameCheck !== CHECK.available || emailCheck !== CHECK.available) {
      setError('닉네임과 이메일 중복체크를 완료해주세요.')
      return
    }
    setLoading(true)
    try {
      await register({ nickname, email, password })
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

          <label className="auth-field" htmlFor="nickname">
            <span>닉네임</span>
            <div className="auth-input-wrap auth-input-wrap-action">
              <User size={16} />
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setNicknameCheck(CHECK.idle) }}
                placeholder="닉네임 입력"
                autoComplete="username"
                required
              />
              <div
                className={`auth-check-wrap${
                  nicknameCheck === CHECK.available || nicknameCheck === CHECK.unavailable
                    ? ' auth-check-wrap--has-result'
                    : ''
                }`}
              >
                {(nicknameCheck === CHECK.available || nicknameCheck === CHECK.unavailable) && (
                  <span
                    className={`auth-check-tooltip ${
                      nicknameCheck === CHECK.available
                        ? 'auth-check-tooltip--success'
                        : 'auth-check-tooltip--error'
                    }`}
                    role="tooltip"
                  >
                    {nicknameCheck === CHECK.available
                      ? '사용 가능한 닉네임입니다'
                      : '이미 사용 중인 닉네임입니다'}
                  </span>
                )}
                <button
                  className="auth-check-button"
                  type="button"
                  onClick={handleCheckNickname}
                  disabled={nicknameCheck === CHECK.checking || !nickname.trim()}
                >
                  {nicknameCheck === CHECK.checking ? '확인 중...' : '중복체크'}
                </button>
              </div>
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailCheck(CHECK.idle)
                }}
                placeholder="이메일 입력"
                autoComplete="email"
                required
              />
              <div
                className={`auth-check-wrap${
                  emailCheck === CHECK.available || emailCheck === CHECK.unavailable
                    ? ' auth-check-wrap--has-result'
                    : ''
                }`}
              >
                {(emailCheck === CHECK.available || emailCheck === CHECK.unavailable) && (
                  <span
                    className={`auth-check-tooltip ${
                      emailCheck === CHECK.available
                        ? 'auth-check-tooltip--success'
                        : 'auth-check-tooltip--error'
                    }`}
                    role="tooltip"
                  >
                    {emailCheck === CHECK.available
                      ? '사용 가능한 이메일입니다'
                      : '이미 사용 중인 이메일입니다'}
                  </span>
                )}
                <button
                  className="auth-check-button"
                  type="button"
                  onClick={handleCheckEmail}
                  disabled={emailCheck === CHECK.checking || !email.trim()}
                >
                  {emailCheck === CHECK.checking ? '확인 중...' : '중복체크'}
                </button>
              </div>
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
                onChange={(e) => {
                  setPassword(e.target.value)
                }}
                placeholder="비밀번호 입력"
                autoComplete="new-password"
                required
              />
            </div>
          </label>

          <label className="auth-field" htmlFor="password_confirm">
            <span>비밀번호 확인</span>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="password_confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value)
                }}
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
                required
              />
            </div>
            {passwordConfirm && !passwordsMatch && (
              <p className="auth-field-msg auth-field-msg--error">비밀번호가 일치하지 않습니다.</p>
            )}
          </label>

          <button className="auth-submit" type="submit" disabled={!canSubmit}>
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
