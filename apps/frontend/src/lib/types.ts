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
