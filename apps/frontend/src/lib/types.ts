export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface User {
  id: number
  name: string
  email: string
  location?: string | null
  avatar_url?: string | null
  session_id?: number
}

export interface AuthResponse extends User {
  token: string
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
  location?: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface MessageResponse {
  message: string
}

export interface Session {
  id: number
  device: string
  ip: string
  created_at: string
}

export interface UploadedFile {
  id: number
  name: string
  original_name: string
  mime_type: string
  size: number
  folder_id: string
  drive_file_id?: string
  status: string
  created_at: string
  insight?: FileInsight | null
}

export interface SensitiveFlag {
  kind: "personal_ids" | "compensation" | "bank_details" | "health" | "credentials"
  detail: string
}

export interface FileInsight {
  status: "pending" | "ready" | "failed"
  category: string | null
  summary: string | null
  sensitive: SensitiveFlag[]
  source: "claude" | "heuristic" | null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  webViewLink?: string
  iconLink?: string
}

export interface DriveFilesResponse {
  files: DriveFile[]
  next_page_token: string | null
}

export interface DriveImportResponse {
  files: UploadedFile[]
  errors: { name: string; error: string }[]
}

export interface FolderItem {
  id: number
  name: string
  color: string
  parent_id: number | null
  status: string
  created_at: string | null
}

export interface ActivityEntry {
  id: number
  action: string
  file_name: string
  folder_id: string
  details: string | null
  created_at: string
}

export interface ShareLink {
  id: number
  token: string
  name: string
  folder_id: number | null
  folder_name: string | null
  has_password: boolean
  expires_at: string | null
  allow_download: boolean
  revoked: boolean
  expired: boolean
  created_at: string
  viewer_count: number
  event_count: number
  last_access_at: string | null
}

export interface CreateSharePayload {
  folder_id: number | null
  name?: string
  password?: string
  expires_in_days?: number | null
  allow_download: boolean
}

export interface ShareAccessEntry {
  id: number
  viewer_email: string
  action: "opened" | "viewed" | "downloaded"
  file_name: string | null
  ip: string
  created_at: string
}

export interface PublicShareInfo {
  name: string
  owner_name: string
  requires_password: boolean
  allow_download: boolean
  expires_at: string | null
}

export interface PublicShareFile {
  id: number
  name: string
  size: number
  mime_type: string | null
  created_at: string
  viewable: boolean
}

export interface PublicShareContents {
  path: { id: number; name: string }[]
  folders: { id: number; name: string; color: string }[]
  files: PublicShareFile[]
}

export interface ShareAnalytics {
  totals: { viewers: number; seconds: number; views: number; downloads: number }
  viewers: {
    email: string
    opens: number
    views: number
    downloads: number
    seconds: number
    first_seen: string | null
    last_seen: string | null
  }[]
  documents: {
    file_id: number
    file_name: string
    views: number
    downloads: number
    seconds: number
    viewers: number
    pages: { page: number; seconds: number }[]
  }[]
  daily: { date: string; events: number }[]
}

export interface ChecklistItem {
  id: string
  category: string
  title: string
  status: "covered" | "partial" | "missing"
  note: string
  evidence: { id: number; name: string }[]
}

export interface DiligenceOverview {
  ai_enabled: boolean
  ai_model: string | null
  source: "claude" | "heuristic"
  reviewed_at: string | null
  checklist: ChecklistItem[]
  categories: { category: string; count: number }[]
  sensitive_files: { id: number; name: string; sensitive: SensitiveFlag[] }[]
  total_files: number
  unanalyzed: number
  pending: number
}

export interface SharePreview {
  total: number
  flagged: { id: number; name: string; sensitive: SensitiveFlag[] }[]
}

export interface Question {
  id: number
  file_id: number | null
  file_name: string | null
  page: number | null
  body: string
  answer: string | null
  status: "open" | "answered"
  answered_at: string | null
  created_at: string
}

export interface OwnerQuestion extends Question {
  viewer_email: string
  link_id: number
  link_name: string
}

export interface DraftAnswer {
  answer: string
  citations: { file_id: number; file_name: string; quote: string }[]
  source: "claude" | "heuristic"
}
