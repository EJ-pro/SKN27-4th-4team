import { Dumbbell, Camera, Play, X } from 'lucide-react'

const footerLinks = {
  '프로그램': ['전체 프로그램', '근력 훈련', '체지방 감량', 'HIIT & 유산소'],
  '식단':   ['AI 식단 플랜', '건강 레시피', '영양 코칭', '보충제 가이드'],
  '지원':   ['고객센터', '커뮤니티', '자주 묻는 질문', '문의하기'],
}

const socials = [
  { Icon: Camera, label: 'Instagram' },
  { Icon: Play,   label: 'Youtube' },
  { Icon: X,      label: 'Twitter' },
]

const policyLinks = [
  { label: '개인정보처리방침', href: 'https://www.notion.so/379baef6b101802da6f1f572a71ee159?source=copy_link' },
  { label: '이용약관', href: 'https://www.notion.so/379baef6b10180d6a39bf599d97121cb?source=copy_link' },
  { label: '쿠키 정책', href: 'https://www.notion.so/379baef6b10180d3a9a7e76cddf9e73f?source=copy_link' },
]

export default function Footer() {
  return (
    <footer style={{
      background: '#060606',
      borderTop: '1px solid rgba(255,215,0,0.07)',
      padding: '64px 48px 32px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Top */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1fr 1fr 1.3fr',
          gap: 40,
          paddingBottom: 48,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          marginBottom: 28,
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(255,215,0,0.2)',
              }}>
                <Dumbbell size={19} color="#000" strokeWidth={2.8} />
              </div>
              <span style={{ fontFamily: 'Bebas Neue', fontSize: 24, letterSpacing: 2, color: '#FFD700' }}>HELBOTIN</span>
            </div>
            <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', lineHeight: 1.9, marginBottom: 22, maxWidth: 220 }}>
              AI 기술로 모든 사람의 건강하고 강한 삶을 실현하는 피트니스 플랫폼.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {socials.map(({ Icon, label }) => (
                <button key={label} aria-label={label} style={{
                  width: 36, height: 36,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.22s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.35)'; e.currentTarget.style.background = 'rgba(255,215,0,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                >
                  <Icon size={15} color="rgba(255,255,255,0.4)" />
                </button>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([cat, items]) => (
            <div key={cat}>
              <h4 style={{
                fontFamily: 'Bebas Neue', fontSize: 15,
                color: 'rgba(255,255,255,0.7)', letterSpacing: 2.5, marginBottom: 18,
              }}>{cat}</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
                {items.map(item => (
                  <li key={item}>
                    <a href="#" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', transition: 'color 0.2s', letterSpacing: 0.3 }}
                    onMouseEnter={e => e.target.style.color = '#FFD700'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
                    >{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div>
            <h4 style={{ fontFamily: 'Bebas Neue', fontSize: 15, color: 'rgba(255,255,255,0.7)', letterSpacing: 2.5, marginBottom: 18 }}>
              뉴스레터
            </h4>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.8, marginBottom: 18 }}>
              운동 팁, 식단 정보,<br />프로모션을 매주 받아보세요.
            </p>
            <div style={{ display: 'flex' }}>
              <input
                type="email"
                placeholder="이메일 입력"
                style={{
                  flex: 1,
                  background: '#111',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRight: 'none',
                  padding: '10px 14px',
                  color: '#FFF', fontSize: 12,
                  borderRadius: '5px 0 0 5px',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button style={{
                background: 'linear-gradient(135deg, #FFD700, #C8A200)',
                color: '#000', fontWeight: 800, fontSize: 11,
                padding: '10px 16px',
                borderRadius: '0 5px 5px 0',
                letterSpacing: 0.5, flexShrink: 0,
              }}>구독</button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.2)' }}>
            © 2025 HELBOTIN. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 28 }}>
            {policyLinks.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.2)', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#FFD700'}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.2)'}
              >{label}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
