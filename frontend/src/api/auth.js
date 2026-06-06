// ─── 인증 API ────────────
// ─── 기존 함수들과 통신 방식이 다르고 재활용해야 해서 별도로 구현함 ──────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
    return match ? decodeURIComponent(match[2]) : ''
}

async function ensureCsrfCookie() {
    await fetch(`${API_URL}/api/auth/csrf/`, { credentials: 'include' })
}

async function authFetch(path, options = {}) {
    await ensureCsrfCookie()
    const csrfToken = getCookie('csrftoken')
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

export function register({ nickname, email, password }) {
    return authFetch('/api/auth/register/', {
        method: 'POST',
        body: JSON.stringify({ nickname, email, password }),
    })
}

export function login({ nickname, passowrd }) {
    return authFetch('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ nickname, password }),
    })
}

export function logout() {
    return authFetch('/api/auth/logout/', {
        method: 'POST',
    })
}

export function getMe() {
    return authFetch('/api/auth/me/')
}