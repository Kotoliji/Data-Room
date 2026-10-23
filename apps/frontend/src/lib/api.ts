import type { ApiResponse, User, AuthResponse, RegisterPayload, LoginPayload, MessageResponse, UpdateProfilePayload, Session, UploadedFile, DriveFilesResponse, DriveImportResponse, DriveFile, ActivityEntry, FolderItem, ShareLink, CreateSharePayload, ShareAccessEntry, PublicShareInfo, PublicShareContents, ShareAnalytics, DiligenceOverview, SharePreview, Question, OwnerQuestion, DraftAnswer } from "./types"

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000"
const BASE_URL = `${API_BASE}/api/v1`

function getToken(): string | null {
  return localStorage.getItem("auth_token")
}

async function request<T>(endpoint: string, options: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken()
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string>) ?? {}),
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null) as ApiResponse<T> | null
      return { data: null, error: body?.error ?? `Request failed (${res.status})` }
    }
    return await res.json() as ApiResponse<T>
  } catch {
    return { data: null, error: "Server is unavailable. Please try again later." }
  }
}

async function requestFormData<T>(endpoint: string, body: FormData): Promise<ApiResponse<T>> {
  const token = getToken()
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
      body,
    })
    if (!res.ok) {
      const respBody = await res.json().catch(() => null) as ApiResponse<T> | null
      return { data: null, error: respBody?.error ?? `Request failed (${res.status})` }
    }
    return await res.json() as ApiResponse<T>
  } catch {
    return { data: null, error: "Server is unavailable." }
  }
}

export function register(payload: RegisterPayload): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function login(payload: LoginPayload): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function forgotPassword(email: string): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(token: string, password: string): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  })
}

export function getProfile(): Promise<ApiResponse<User>> {
  return request<User>("/auth/me", { method: "GET" })
}

export function updateProfile(payload: UpdateProfilePayload): Promise<ApiResponse<User>> {
  return request<User>("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function changePassword(oldPassword: string, newPassword: string): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/password", {
    method: "PUT",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  })
}

export function uploadAvatar(file: File): Promise<ApiResponse<{ avatar_url: string }>> {
  const formData = new FormData()
  formData.append("avatar", file)
  return requestFormData<{ avatar_url: string }>("/auth/avatar", formData)
}

export function getSessions(): Promise<ApiResponse<Session[]>> {
  return request<Session[]>("/auth/sessions", { method: "GET" })
}

export function revokeSession(sessionId: number): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>(`/auth/sessions/${sessionId}`, { method: "DELETE" })
}

export function revokeAllSessions(): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/sessions", { method: "DELETE" })
}

export function deleteAccount(password: string): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  })
}

export async function getGoogleConnectUrl(): Promise<string | null> {
  const res = await request<{ auth_url: string }>("/auth/google/connect", { method: "GET" })
  if (res.data) return res.data.auth_url
  return null
}

export async function getGoogleDriveStatus(): Promise<boolean> {
  const res = await request<{ connected: boolean }>("/auth/google/status", { method: "GET" })
  return res.data?.connected === true
}

export interface UploadResult {
  files: UploadedFile[]
  skipped: { name: string; reason: string }[]
}

export function uploadFiles(files: File[], folderId?: string): Promise<ApiResponse<UploadResult>> {
  const formData = new FormData()
  files.forEach((f) => formData.append("files", f))
  if (folderId) formData.append("folder_id", folderId)
  return requestFormData<UploadResult>("/files/upload", formData)
}

export function getFiles(folderId?: string): Promise<ApiResponse<{ files: UploadedFile[] }>> {
  const query = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : ""
  return request<{ files: UploadedFile[] }>(`/files${query}`, { method: "GET" })
}

export function deleteFile(fileId: number): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>(`/files/${fileId}`, { method: "DELETE" })
}

export async function getFileViewUrl(fileId: number): Promise<string | null> {
  const res = await request<{ url: string }>(`/files/${fileId}/token`, { method: "GET" })
  return res.data?.url ?? null
}

export function renameFile(fileId: number, name: string): Promise<ApiResponse<UploadedFile>> {
  return request<UploadedFile>(`/files/${fileId}/rename`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  })
}

export function moveFile(fileId: number, folderId: string): Promise<ApiResponse<UploadedFile>> {
  return request<UploadedFile>(`/files/${fileId}/move`, {
    method: "PUT",
    body: JSON.stringify({ folder_id: folderId }),
  })
}

export function getDriveFiles(pageToken?: string, query?: string, parentId?: string): Promise<ApiResponse<DriveFilesResponse>> {
  const params = new URLSearchParams()
  if (pageToken) params.set("page_token", pageToken)
  if (query) params.set("q", query)
  if (parentId) params.set("parent_id", parentId)
  const qs = params.toString()
  return request<DriveFilesResponse>(`/drive/files${qs ? `?${qs}` : ""}`, { method: "GET" })
}

export function importDriveFiles(files: DriveFile[], folderId?: string): Promise<ApiResponse<DriveImportResponse>> {
  return request<DriveImportResponse>("/drive/import", {
    method: "POST",
    body: JSON.stringify({ files, folder_id: folderId ?? "all" }),
  })
}

export function disconnectGoogleDrive(): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/auth/google/disconnect", { method: "POST" })
}

export function getGoogleLoginUrl(mode: "login" | "register" = "login"): string {
  return `${API_BASE}/api/v1/auth/google/login?mode=${mode}`
}

export function exchangeGoogleCode(code: string): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>("/auth/google/exchange", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}


export function getActivity(folderId?: string): Promise<ApiResponse<{ activity: ActivityEntry[] }>> {
  const params = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : ""
  return request<{ activity: ActivityEntry[] }>(`/activity${params}`, { method: "GET" })
}

export function clearActivity(): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>("/activity", { method: "DELETE" })
}

export function getFolders(parentId?: number): Promise<ApiResponse<{ folders: FolderItem[] }>> {
  const params = parentId != null ? `?parent_id=${parentId}` : ""
  return request<{ folders: FolderItem[] }>(`/folders${params}`, { method: "GET" })
}

export function getAllFolders(): Promise<ApiResponse<{ folders: FolderItem[] }>> {
  return request<{ folders: FolderItem[] }>("/folders?all=1", { method: "GET" })
}

export function createFolder(name: string, parentId?: number, color?: string): Promise<ApiResponse<FolderItem>> {
  return request<FolderItem>("/folders", {
    method: "POST",
    body: JSON.stringify({ name, parent_id: parentId ?? null, color: color ?? "#3e90f0" }),
  })
}

export function updateFolder(folderId: number, data: { name?: string; color?: string; parent_id?: number | null }): Promise<ApiResponse<FolderItem>> {
  return request<FolderItem>(`/folders/${folderId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export function deleteFolder(folderId: number): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>(`/folders/${folderId}`, { method: "DELETE" })
}

export function deleteFolderPermanent(folderId: number): Promise<ApiResponse<MessageResponse>> {
  return request<MessageResponse>(`/folders/${folderId}/permanent`, { method: "DELETE" })
}

export function restoreFolder(folderId: number): Promise<ApiResponse<FolderItem>> {
  return request<FolderItem>(`/folders/${folderId}/restore`, { method: "POST" })
}

export function getTrashedFolders(): Promise<ApiResponse<{ folders: FolderItem[] }>> {
  return request<{ folders: FolderItem[] }>("/folders?status=trashed", { method: "GET" })
}

export function getFolderPath(folderId: number): Promise<ApiResponse<{ path: FolderItem[] }>> {
  return request<{ path: FolderItem[] }>(`/folders/${folderId}/path`, { method: "GET" })
}

// --------------- Sharing (owner) ---------------

export function getShares(): Promise<ApiResponse<{ shares: ShareLink[] }>> {
  return request<{ shares: ShareLink[] }>("/shares", { method: "GET" })
}

export function createShare(payload: CreateSharePayload): Promise<ApiResponse<ShareLink>> {
  return request<ShareLink>("/shares", { method: "POST", body: JSON.stringify(payload) })
}

export function revokeShare(linkId: number): Promise<ApiResponse<ShareLink>> {
  return request<ShareLink>(`/shares/${linkId}`, { method: "DELETE" })
}

export function getShareAccesses(linkId: number): Promise<ApiResponse<{ accesses: ShareAccessEntry[] }>> {
  return request<{ accesses: ShareAccessEntry[] }>(`/shares/${linkId}/accesses`, { method: "GET" })
}

export function getShareAnalytics(linkId: number): Promise<ApiResponse<ShareAnalytics>> {
  return request<ShareAnalytics>(`/shares/${linkId}/analytics`, { method: "GET" })
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`
}

// --------------- Sharing (external viewer) ---------------

export function getPublicShare(token: string): Promise<ApiResponse<PublicShareInfo>> {
  return request<PublicShareInfo>(`/public/shares/${token}`, { method: "GET" })
}

export function unlockShare(token: string, email: string, password: string): Promise<ApiResponse<{ access_token: string }>> {
  return request<{ access_token: string }>(`/public/shares/${token}/unlock`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
}

export function getShareContents(token: string, access: string, folderId?: number): Promise<ApiResponse<PublicShareContents>> {
  const query = folderId != null ? `?folder_id=${folderId}` : ""
  return request<PublicShareContents>(`/public/shares/${token}/contents${query}`, {
    method: "GET",
    headers: { "X-Share-Access": access },
  })
}

export function sharedFileUrl(token: string, access: string, fileId: number, download = false): string {
  const params = new URLSearchParams({ access, ...(download ? { download: "1" } : {}) })
  return `${BASE_URL}/public/shares/${token}/files/${fileId}?${params}`
}

export function sharedFilePagesUrl(token: string, access: string, fileId: number): string {
  return `${BASE_URL}/public/shares/${token}/files/${fileId}/pages?${new URLSearchParams({ access })}`
}

// --------------- Due diligence (AI) ---------------

export function getDiligence(): Promise<ApiResponse<DiligenceOverview>> {
  return request<DiligenceOverview>("/diligence", { method: "GET" })
}

export function runDiligenceReview(): Promise<ApiResponse<DiligenceOverview>> {
  return request<DiligenceOverview>("/diligence/review", { method: "POST" })
}

export function analyzeUnprocessed(): Promise<ApiResponse<{ queued: number }>> {
  return request<{ queued: number }>("/diligence/analyze", { method: "POST" })
}

export function searchContent(q: string): Promise<ApiResponse<{ results: { file_id: number; snippet: string }[] }>> {
  return request<{ results: { file_id: number; snippet: string }[] }>(`/files/search?q=${encodeURIComponent(q)}`, { method: "GET" })
}

export function getSharePreview(folderId: number | null): Promise<ApiResponse<SharePreview>> {
  return request<SharePreview>(`/shares/preview${folderId != null ? `?folder_id=${folderId}` : ""}`, { method: "GET" })
}

// --------------- Q&A ---------------

export function getMyQuestions(token: string, access: string): Promise<ApiResponse<{ questions: Question[] }>> {
  return request<{ questions: Question[] }>(`/public/shares/${token}/questions`, {
    method: "GET",
    headers: { "X-Share-Access": access },
  })
}

export function askQuestion(token: string, access: string, body: string, fileId?: number, page?: number): Promise<ApiResponse<Question>> {
  return request<Question>(`/public/shares/${token}/questions`, {
    method: "POST",
    headers: { "X-Share-Access": access },
    body: JSON.stringify({ body, file_id: fileId, page }),
  })
}

export function getQuestions(status: "open" | "answered"): Promise<ApiResponse<{ questions: OwnerQuestion[]; open_count: number }>> {
  return request<{ questions: OwnerQuestion[]; open_count: number }>(`/questions?status=${status}`, { method: "GET" })
}

export function answerQuestion(id: number, answer: string): Promise<ApiResponse<OwnerQuestion>> {
  return request<OwnerQuestion>(`/questions/${id}/answer`, { method: "POST", body: JSON.stringify({ answer }) })
}

export function draftAnswer(id: number): Promise<ApiResponse<DraftAnswer>> {
  return request<DraftAnswer>(`/questions/${id}/draft`, { method: "POST" })
}
