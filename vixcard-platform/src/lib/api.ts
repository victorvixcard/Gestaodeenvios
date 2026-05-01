const BASE = '/api'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Erro na requisição')
  return data as T
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string)                => request<T>('DELETE', path),
}
