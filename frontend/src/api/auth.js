/**
 * 인증 API 클라이언트.
 *
 * 게스트 API(ConsultPage·RoutinePage의 device_uuid)와 분리하여,
 * 세션 쿠키 + CSRF 기반으로 동작한다.
 * 모든 요청에 credentials: 'include'가 필요하다.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/** @type {string} CSRF 엔드포인트 응답에서 받은 토큰 (크로스 오리진용) */
let cachedCsrfToken = ''

/**
 * document.cookie에서 이름으로 쿠키 값을 읽는다.
 *
 * @param {string} name - 쿠키 이름 (예: 'csrftoken')
 * @returns {string} 쿠키 값. 없으면 빈 문자열
 */
function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : ''
}

/**
 * CSRF 토큰 쿠키(csrftoken)를 서버에서 받아온다.
 * POST 요청 전에 한 번 호출되어야 Django CsrfViewMiddleware가 통과한다.
 *
 * @returns {Promise<void>}
 */
async function ensureCsrfCookie() {
  const res = await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (data.csrfToken) {
    cachedCsrfToken = data.csrfToken
  }
}

/**
 * 인증 API 공통 fetch 래퍼.
 *
 * - CSRF 쿠키 확보 후 X-CSRFToken 헤더를 붙인다.
 * - credentials: 'include'로 sessionid 쿠키를 함께 전송한다.
 * - 실패 시 서버의 {"error": "..."} 메시지를 Error로 throw한다.
 *
 * @param {string} path - API 경로 (예: '/api/auth/login/')
 * @param {RequestInit} [options={}] - fetch 옵션 (method, body 등)
 * @returns {Promise<object>} 파싱된 JSON 응답 body
 * @throws {Error} HTTP 4xx/5xx 또는 네트워크 오류 시
 */
async function authFetch(path, options = {}) {
  await ensureCsrfCookie()
  const csrfToken = cachedCsrfToken || getCookie('csrftoken')
  const headers = {
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...options.headers,
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `API 요청 실패 (${res.status})`)
  }
  return data
}

/**
 * 닉네임 중복 여부 조회.
 * @param {string} nickname
 * @returns {Promise<{ available: boolean }>}
 */
export function checkNickname(nickname) {
  const q = encodeURIComponent(nickname)
  return authFetch(`/api/auth/check-nickname/?nickname=${q}`)
}

/**
 * 이메일 중복 여부 조회.
 * @param {string} email
 * @returns {Promise<{ available: boolean }>}
 */
export function checkEmail(email) {
  const q = encodeURIComponent(email)
  return authFetch(`/api/auth/check-email/?email=${q}`)
}

/**
 * 회원가입.
 *
 * @param {{ nickname: string, email: string, password: string }} params
 * @param {string} params.nickname - 닉네임
 * @param {string} params.email - 이메일
 * @param {string} params.password - 비밀번호
 * @returns {Promise<{ user_id: number, nickname: string, email: string }>}
 * @throws {Error} 검증 실패·중복 등 (400)
 */
export function register({ nickname, email, password }) {
  return authFetch('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify({ nickname, email, password }),
  })
}

/**
 * @param {{ email: string, password: string, device_uuid?: string }} params
 */
export function login({ email, password, device_uuid }) {
  const body = { email, password }
  if (device_uuid) body.device_uuid = device_uuid
  return authFetch('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * 로그아웃. 세션을 삭제하고 sessionid·JWT를 함께 제거한다.
 *
 * @returns {Promise<{ ok: boolean }>}
 */
export function logout() {
  return authFetch('/api/auth/logout/', {
    method: 'POST',
  })
}

/**
 * 현재 로그인 사용자 정보 조회.
 * Navbar 등에서 로그인 상태 확인에 사용한다.
 *
 * @returns {Promise<{ user_id: number, nickname: string, email: string }>}
 * @throws {Error} 미로그인 (401)
 */
export function getMe() {
  return authFetch('/api/auth/me/')
}
