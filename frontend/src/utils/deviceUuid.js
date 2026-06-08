const KEY = 'fitai_device_uuid'

function readCookie() {
    const match = document.cookie.split('; ').find((r) => r.startsWith(`${KEY}=`))
    return match ? match.split('=')[1] : ''
}

function writeCookie(uuid) {
    document.cookie = `${KEY}=${uuid}; max-age=${60 * 60 * 24 * 365}; path=/`
}

/**
 * @returns {string} device UUID (쿠키·localStorage 동기화)
 */
export function getOrCreateDeviceUuid() {
    if (typeof window === 'undefined') return ''

    let uuid = readCookie() || localStorage.getItem(KEY) || ''
    
    if (!uuid) {
        uuid =
            typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    }

    if (!readCookie()) writeCookie(uuid)
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, uuid)

    return uuid
}
