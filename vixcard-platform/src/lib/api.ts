const BASE = '/api'

// Timeout padrão de 15 segundos para todas as requisições
const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export class ApiTimeoutError extends Error {
  constructor() {
    super('A requisição demorou muito. Verifique sua conexão e tente novamente.')
    this.name = 'ApiTimeoutError'
  }
}

export function getToken(): string | null {
  return localStorage.getItem('vixcard_token')
}

export function setToken(token: string): void {
  localStorage.setItem('vixcard_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('vixcard_token')
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (res.status === 204) return undefined as T
    const data = await res.json()
    // Token expirado ou revogado: volta para o login em vez de espalhar
    // erros 401 pelas telas. O proprio /login devolve 401 para senha errada,
    // entao fica de fora.
    if (res.status === 401 && !path.startsWith('/login')) {
      clearToken()
      window.location.href = '/login?expirado=1'
    }
    if (!res.ok) throw new ApiError(res.status, data.message ?? 'Erro na requisição')
    return data as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiTimeoutError()
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function upload<T>(path: string, file: File): Promise<T> {
  const controller = new AbortController()
  // Upload pode demorar mais — 60 segundos
  const timer = setTimeout(() => controller.abort(), 60_000)

  const token = getToken()
  const form  = new FormData()
  form.append('file', file)

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
      signal: controller.signal,
    })

    if (res.status === 204) return undefined as T
    const data = await res.json()
    if (!res.ok) throw new ApiError(res.status, data.message ?? 'Erro no upload')
    return data as T
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiTimeoutError()
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string)                => request<T>('DELETE', path),
  upload: <T>(path: string, file: File)    => upload<T>(path, file),
}
