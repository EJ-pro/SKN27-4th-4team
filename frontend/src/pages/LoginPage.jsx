import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100vh', background: '#0F0F0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: 32, color: '#FFD700', letterSpacing: 4, marginBottom: 12 }}>
          로그인
        </div>
        <p>준비 중입니다.</p>
        <button
          onClick={() => navigate('/consult')}
          style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 8,
            background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)',
            color: '#FFD700', fontSize: 13, cursor: 'pointer',
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  )
}
