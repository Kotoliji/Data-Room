# Acme Corp Data Room

A virtual Data Room MVP for securely storing and managing due diligence documents. Users connect their Google Drive via OAuth, browse and import files, then view and manage them in an organized repository.

---

## How to Test

**Live demo:** [https://virtuous-presence-production-6468.up.railway.app/](https://virtuous-presence-production-6468.up.railway.app/)

The Google OAuth app is in testing mode, so only approved test users can connect Drive. Credentials for a pre-filled demo Google account are shared privately on request — they are intentionally not published here.

### Step-by-step

1. Open the live demo and click **"Register"** to create a Data Room account (or use **"Sign in with Google"**)
2. Inside the Data Room, click **"Import"** → **"Upload from Google Drive"**
3. Connect Google Drive with the demo Google account (or your own account, if it is added as a test user)
4. Browse folders, select files with checkboxes, click **"Import"**
5. Files appear in your Data Room — click the eye icon to **view in browser**
6. Try **renaming** (pencil icon), **moving** (drag & drop), and **deleting** (trash icon)

### Features to try

| Feature                  | How                                                             |
| ------------------------ | --------------------------------------------------------------- |
| Import from Google Drive | Import button → Upload from Google Drive → select files         |
| View file in browser     | Click the eye icon — PDFs and images open inline                |
| Delete file              | Trash icon — removes from Data Room only, not from Google Drive |
| Create folders           | Sidebar "New folder" or button inside folder view               |
| Nested folders           | Create folders inside folders, navigate with breadcrumbs        |
| Drag & drop              | Drag files/folders between folders in the sidebar               |
| Search                   | Type in the search bar to filter by file name                   |
| Activity log             | Switch to "Activity" tab in sidebar                             |
| Share with investors     | Open a folder → **Share** → set password / expiry / downloads   |
| Who viewed what          | "Sharing" tab → expand a link → Analytics / Access log          |
| In-app PDF viewer        | Click any PDF — zoom, page counter, lazy page rendering          |
| AI due diligence         | "Diligence" tab → checklist coverage, Run AI review             |
| Search inside documents  | Type 3+ characters in search — matches in file text are tagged   |
| Google Sign-In           | Use the Google button on login/register pages                   |

---

## Table of Contents

- [Quick Start (Local)](#quick-start-local)
- [Setup from Scratch](#setup-from-scratch)
- [Functional Requirements Coverage](#functional-requirements-coverage)
- [Design Decisions](#design-decisions)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Edge Cases Handled](#edge-cases-handled)

---

## Quick Start (Local)

```bash
# 1. Clone the repo
git clone <repo-url> && cd Data-Room

# 2. Backend
cd apps/backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Then fill in Google credentials (see below)
python run.py                 # Runs on http://localhost:5000

# 3. Frontend (new terminal)
cd apps/frontend
npm install
npm run dev                   # Runs on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

### Tests & CI

```bash
cd apps/backend
pip install -r requirements-dev.txt
pytest -q          # 45 tests: auth, files, folders/trash, sharing scope, Drive import (mocked), security, migrations
```

GitHub Actions runs backend tests plus frontend lint and build on every push and pull request.

### Database migrations

The schema is managed by Alembic (Flask-Migrate) and upgraded automatically on startup. Databases created before Alembic was introduced are detected, brought up to the baseline and stamped — no manual steps. To change the schema:

```bash
cd apps/backend
flask --app run.py db migrate -m "describe change"   # then review migrations/versions/*
```

---

## Setup from Scratch

### Prerequisites

- Python 3.11+
- Node.js 20+
- A Google Cloud project with OAuth 2.0 credentials

### Google Cloud Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. **Enable APIs**: Google Drive API
4. **Create OAuth 2.0 Client ID** (type: Web application)
5. **Authorized redirect URIs** — add both:
   ```
   http://localhost:5000/api/v1/auth/google/callback
   http://localhost:5000/api/v1/auth/google/login/callback
   ```
6. Copy Client ID and Client Secret
7. Go to **OAuth consent screen** → add test users (any Google emails that will test the app)

### Backend `.env`

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
SECRET_KEY=any-random-secret-string
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
```

---

## Functional Requirements Coverage

### Required

| Requirement                                   | Status | Implementation                                                                                      |
| --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Import files from Google Drive into Data Room | Done   | Custom Drive file picker with folder navigation, search, pagination. Files download to server disk. |
| View file list in UI                          | Done   | File list with name, size, date. Organized by folders with drag & drop.                             |
| Click on file to view in browser              | Done   | PDFs and images open inline. DOCX/XLSX download. Google Docs auto-convert to PDF.                   |
| Delete a file (not in Google Drive)           | Done   | Deletes from Data Room and server disk only. Google Drive untouched.                                |

### Optional (Extra Credit)

| Requirement          | Status | Implementation                                                                         |
| -------------------- | ------ | -------------------------------------------------------------------------------------- |
| Authentication layer | Done   | Email/password registration + Google Sign-In. Session management with device tracking. |
| Search and filtering | Done   | Real-time search by file name within the current folder.                               |

### Beyond Requirements

- **Secure external sharing** — the core of a real data room: links to a folder subtree or the whole room, with optional password, expiry, view-only mode and revocation
- **Access trail** — every viewer identifies by email; each open, view and download is recorded per link
- **In-app PDF viewer** (pdf.js, lazy-loaded) with **page-level engagement tracking**: owners see time spent per page as a heatmap, the most engaged viewers and 14-day activity
- **AI due diligence** (Claude): every document is classified into a standard DD category with a one-line summary and sensitive-data flags; the room is scored against a 16-item M&A checklist with evidence per item; sharing warns before exposing sensitive files
- **Full-text search** inside PDF, DOCX, XLSX, PPTX and TXT documents
- **Dynamic watermarking** — every PDF served through a share link has the viewer's email and date burned into each page on the server
- **Nested folder system** with unlimited depth, breadcrumb navigation, drag & drop
- **Activity log** tracking all file operations per folder
- **Profile management** with avatar upload
- **Dark/light theme** with system preference detection
- **Responsive design** with mobile sidebar

---

## Design Decisions

### Database: SQLite (Postgres-ready)

SQLite was chosen for zero-setup local development — it ships with Python and needs no external server. All database access goes through SQLAlchemy ORM, so migrating to Postgres for production requires only changing the connection string. For an MVP handling single-user workflows, SQLite is more than sufficient.

### File Storage: Local Disk

Per the assignment requirements, files are persisted on server disk at `backend/storage/{user_id}/`. Each file is prefixed with a UUID to prevent name collisions. This approach is simple, reliable, and avoids the complexity of blob storage for an MVP.

### OAuth Token Security

All Google OAuth tokens are stored server-side only — they are never sent to the frontend. The backend automatically refreshes expired access tokens using the stored refresh token. If the refresh token itself is revoked, the user is prompted to reconnect their Google Drive.

Tokens are encrypted at rest with Fernet (AES-128 + HMAC); the key is derived from `TOKEN_ENCRYPTION_KEY` or `SECRET_KEY`. The app refuses to start without a strong `SECRET_KEY`.

### Hardening

- **Safe file viewing** — the MIME type is derived on the server from the file extension, never from the client's `Content-Type`. Only passive formats (PDF, images, plain text) render inline; HTML, SVG and everything else are forced to download, with `nosniff` and a sandboxing CSP, so an uploaded file can never run scripts on the app's origin.
- **Rate limiting** — login, registration, password reset and Google code exchange are throttled per client IP (Flask-Limiter), with a JSON `429` response.
- **Proxy-aware client IP** — `ProxyFix` trusts exactly one proxy hop, so the IP shown in active sessions cannot be spoofed with a forged `X-Forwarded-For` header.

Signed tokens (via `itsdangerous`) are used for OAuth state parameters and Google login callbacks, preventing CSRF and state tampering attacks.

### Custom Drive File Picker

Instead of using Google's off-the-shelf file picker, I built a custom picker that:

- Navigates folders with breadcrumbs (just like Google Drive)
- Supports search within Drive
- Shows file icons, sizes, and dates
- Allows multi-select with checkboxes
- Persists selection across folder navigation
- Paginates large directories with "Load more"

This gives full control over the UX and avoids the Google Picker API's domain restrictions for localhost development.

### Duplicate Detection

Each imported file stores its Google Drive `file_id`. Re-importing the same file returns the existing record instead of downloading again, preventing duplicates and saving bandwidth.

### Google Docs Handling

Google Docs, Sheets, and Slides cannot be downloaded as-is (they have no binary content). The backend automatically exports them:

- Documents → PDF
- Spreadsheets → XLSX
- Presentations → PDF

### Folder Architecture

Folders use a self-referential `parent_id` foreign key, supporting unlimited nesting. Virtual folders (All documents, Trash, Recently imported) exist only in frontend logic with no database records. This separation keeps the data model clean while providing a rich UX.

### External Sharing & Access Trail

A data room exists to give outside parties (buyers, investors, auditors) controlled access, so sharing is modeled explicitly:

- `ShareLink` points at a folder (its whole subtree) or at the entire room (`folder_id = NULL`). The token is 192 bits from `secrets.token_urlsafe`.
- Viewers open `/s/<token>`, enter their email (and the password, if set) and get a signed access token valid for 8 hours. Revocation and expiry are checked on **every** request, so revoking cuts off viewers who are already inside.
- Scope is enforced on the server by walking up the folder tree to the link's root: folders and files outside the subtree, or in Trash, return 404 even when requested by id.
- View-only links serve only passive formats inline (PDF, images, text) and refuse downloads. This is best-effort by nature: anything a browser can display can be saved.
- `ShareAccess` rows record `opened`, `viewed` and `downloaded` events with email and IP. They have no foreign key to files, so the trail outlives deleted documents. Revoked links are kept, never deleted, for the same reason.

### Viewer Analytics & Watermarking

- **Time on page.** The in-app viewer (pdf.js, loaded only when a PDF opens) tracks which page is most visible and, while the tab is in front, credits one second per tick to it. It reports every 15 seconds and on tab close via `navigator.sendBeacon`. Beacons are sent as `text/plain` so they stay CORS-simple across origins. The server caps what a single report can add (120 s) and keeps one row per viewer, file and page.
- **Analytics endpoint.** It aggregates the access trail and page times into KPIs, per-viewer engagement, a per-document page heatmap and 14-day activity. The dashboard uses a single hue: page intensity is a `color-mix` from the theme surface toward the brand blue, so it works in light and dark mode.
- **Watermarking happens on the server**, not as a CSS overlay. Each page of a shared PDF gets a tiled, 12%-opacity stamp (`viewer@email · date`) merged in with `pypdf`, both for in-app viewing and for downloads, so a leaked copy identifies its source. Encrypted or malformed PDFs are served as-is, with a warning in the log.

### AI Due Diligence

AI here does data-room-specific work, not generic "chat with your documents":

| Feature | How it works |
| --- | --- |
| Classification | After upload or import, a background thread extracts text (pypdf; DOCX/PPTX/XLSX parsed as OOXML with no extra dependencies) and asks Claude for a category, a one-sentence summary and sensitive-data flags (personal IDs, compensation, bank details, health data, credentials). |
| Checklist gap analysis | One request sends Claude the room index (name, category, summary per file) and a standard 16-item M&A checklist. Each item is marked covered, partial or missing, citing evidence by file id. Ids that are not in the room are dropped, so the model cannot cite documents that don't exist. |
| Pre-share warning | Creating a share link lists the flagged documents inside the link's scope before anything is exposed. |
| Content search | Extracted text is stored per document; search matches inside files and shows a snippet. |

Implementation notes:

- Claude Opus 5.5 with structured outputs (`output_config.format` JSON schema). Classification is a simple task, so it runs at `effort: "low"`.
- Server-side refusal fallback is enabled (`fallbacks: "default"`).
- Refusals, `max_tokens` and API errors (rate limits, 5xx, network) are handled explicitly. Each one degrades to the heuristic path instead of failing the upload.
- Classification sends only the first 15k characters of a document: the opening pages identify it, and cost per file stays bounded. The full text is still stored for search.
- **Without `ANTHROPIC_API_KEY`** the same features run on keyword and regex heuristics, labelled as such in the UI. Tests and local development never call the API.

### Activity Log

Capped at 100 entries per user — the oldest entry is automatically pruned when a new one arrives. This prevents unbounded growth while keeping recent history accessible. Activity is filterable by folder for contextual relevance.

---

## Authentication Model

The application uses server-signed Bearer tokens for API authentication:

- **Login/Register** returns a signed session token (via `itsdangerous`)
- All authenticated API requests send `Authorization: Bearer <token>` header
- Tokens are bound to a specific user session and validated server-side
- Sessions can be individually revoked (token becomes invalid immediately)
- File viewing uses separate short-lived signed URLs (60s TTL)

> **Note:** For a production deployment, tokens should be stored in HttpOnly cookies
> instead of localStorage to prevent XSS-based token theft. The current localStorage
> approach was chosen for development simplicity.

---

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Browser   │  REST   │    Flask     │  OAuth   │  Google API  │
│  React SPA  │◄──────► │   Backend    │◄────────►│  Drive API   │
│  :5173      │  JSON   │   :5000      │  Token   │              │
└─────────────┘         └──────┬───────┘         └──────────────┘
                               │
                        ┌──────┴───────┐
                        │   SQLite     │
                        │  + Disk FS   │
                        └──────────────┘
```

### Frontend (`apps/frontend/`)

- **React 19** with TypeScript (strict mode, no `any`)
- **Vite** for fast builds and HMR
- **Tailwind CSS v4** for styling
- **Shadcn/ui** for base components (dialogs, buttons, inputs)
- Single `api.ts` file as the API client — all endpoints in one place
- Shared `types.ts` for all TypeScript interfaces

### Backend (`apps/backend/`)

- **Flask 3.1** with Blueprints for modular routing
- **SQLAlchemy** ORM with models: `User`, `Session`, `File`, `Folder`, `ActivityLog`
- **Services layer** separating business logic from routes
- Consistent API response format: `{ "data": ..., "error": null }`

---

## API Reference

### Authentication

| Method | Endpoint                    | Description                  |
| ------ | --------------------------- | ---------------------------- |
| `POST` | `/api/v1/auth/register`     | Register with email/password |
| `POST` | `/api/v1/auth/login`        | Login with email/password    |
| `GET`  | `/api/v1/auth/google/login` | Start Google Sign-In flow    |
| `GET`  | `/api/v1/auth/me`           | Get current user profile     |
| `PUT`  | `/api/v1/auth/profile`      | Update profile               |
| `GET`  | `/api/v1/auth/sessions`     | List active sessions         |

### Google Drive

| Method | Endpoint                      | Description                                            |
| ------ | ----------------------------- | ------------------------------------------------------ |
| `GET`  | `/api/v1/auth/google/connect` | Start Drive OAuth flow                                 |
| `GET`  | `/api/v1/auth/google/status`  | Check Drive connection status                          |
| `GET`  | `/api/v1/drive/files`         | List Drive files (with search, pagination, folder nav) |
| `POST` | `/api/v1/drive/import`        | Import selected files into Data Room                   |

### File Management

| Method   | Endpoint                   | Description                   |
| -------- | -------------------------- | ----------------------------- |
| `POST`   | `/api/v1/files/upload`     | Upload files from computer    |
| `GET`    | `/api/v1/files`            | List Data Room files          |
| `GET`    | `/api/v1/files/:id/view`   | View/download file in browser |
| `PUT`    | `/api/v1/files/:id/rename` | Rename a file                 |
| `PUT`    | `/api/v1/files/:id/move`   | Move file to another folder   |
| `DELETE` | `/api/v1/files/:id`        | Delete file from Data Room    |

### Folders

| Method   | Endpoint                   | Description                         |
| -------- | -------------------------- | ----------------------------------- |
| `GET`    | `/api/v1/folders`          | List folders (filterable by parent) |
| `POST`   | `/api/v1/folders`          | Create a new folder                 |
| `PUT`    | `/api/v1/folders/:id`      | Rename or move a folder             |
| `DELETE` | `/api/v1/folders/:id`      | Delete folder and contents          |
| `GET`    | `/api/v1/folders/:id/path` | Get breadcrumb path                 |

### Sharing

| Method   | Endpoint                                | Description                                  |
| -------- | --------------------------------------- | -------------------------------------------- |
| `GET`    | `/api/v1/shares`                        | List my share links with viewer stats        |
| `POST`   | `/api/v1/shares`                        | Create link (folder, password, expiry, download) |
| `DELETE` | `/api/v1/shares/:id`                    | Revoke link (access trail is kept)           |
| `GET`    | `/api/v1/shares/:id/accesses`           | Access trail: who opened / viewed / downloaded |
| `GET`    | `/api/v1/public/shares/:token`          | Public link info (name, owner, needs password) |
| `POST`   | `/api/v1/public/shares/:token/unlock`   | Email + password → viewer access token       |
| `GET`    | `/api/v1/public/shares/:token/contents` | Browse folders and files inside the link's scope |
| `GET`    | `/api/v1/shares/preview?folder_id=`     | Sensitive documents inside a would-be share scope |
| `GET`    | `/api/v1/shares/:id/analytics`          | KPIs, viewer engagement, page heatmap, daily activity |
| `GET`    | `/api/v1/public/shares/:token/files/:id`| View or download a shared file (logged, PDFs watermarked)|
| `POST`   | `/api/v1/public/shares/:token/files/:id/pages` | Viewer heartbeat: seconds per page          |

### Due Diligence

| Method | Endpoint                     | Description                                              |
| ------ | ---------------------------- | -------------------------------------------------------- |
| `GET`  | `/api/v1/diligence`          | Checklist coverage, categories, sensitive documents      |
| `POST` | `/api/v1/diligence/review`   | Re-run checklist gap analysis (Claude or heuristics)     |
| `POST` | `/api/v1/diligence/analyze`  | Classify documents that predate analysis or failed       |
| `GET`  | `/api/v1/files/search?q=`    | Full-text search inside documents, with snippets         |

### Activity

| Method   | Endpoint           | Description                             |
| -------- | ------------------ | --------------------------------------- |
| `GET`    | `/api/v1/activity` | Get activity log (filterable by folder) |
| `DELETE` | `/api/v1/activity` | Clear activity log                      |

---

## Edge Cases Handled

| Scenario                   | Solution                                                       |
| -------------------------- | -------------------------------------------------------------- |
| Expired OAuth access token | Auto-refreshed using stored refresh token                      |
| Revoked refresh token      | User prompted to reconnect Google Drive                        |
| Duplicate file import      | Detected by `drive_file_id`, returns existing record           |
| Duplicate file names       | Appends (1), (2), ..., up to (100), then UUID suffix           |
| Google Docs/Sheets/Slides  | Auto-exported as PDF or XLSX                                   |
| File deleted from disk     | Returns 404 with clear error message                           |
| Google API unavailable     | Returns 503, frontend shows toast notification                 |
| File exceeds 50MB          | Rejected client-side and server-side with message              |
| Unsupported file type      | Skipped with reason shown in toast                             |
| Account deletion           | Cleans up files on disk, sessions, activity logs, localStorage |
| Same email re-registration | localStorage data from previous account is cleared             |
| OAuth state tampering      | Signed with `itsdangerous`, validated with 10-minute expiry    |

---

## Data Models

```
User
├── id, name, email, password_hash
├── google_access_token, google_refresh_token, google_token_expiry
├── google_connected, avatar_path, location
└── created_at

File
├── id, name, original_name, mime_type, size, path
├── drive_file_id (nullable — set for Google Drive imports)
├── folder_id (string — references Folder.id or virtual folder name)
├── user_id, status, created_at

Folder
├── id, name, color, status (active/trashed)
├── parent_id (self-ref, nullable — null = root level)
├── user_id, created_at

ActivityLog
├── id, user_id, action, file_name
├── folder_id, details, created_at

Session
├── id, user_id, device, ip
├── created_at, is_active

ShareLink
├── id, token (unique), user_id, folder_id (nullable — null = entire room)
├── name, password_hash, expires_at, allow_download, revoked
└── created_at

ShareAccess
├── id, link_id, viewer_email, action (opened/viewed/downloaded)
└── file_id, file_name, ip, created_at

SharePageView                      (unique per link + viewer + file + page)
├── id, link_id, viewer_email, file_id, file_name
└── page, seconds, updated_at

DocumentInsight                    (one per file)
├── id, file_id, status (pending/ready/failed), source (claude/heuristic)
└── category, summary, sensitive (JSON), text, updated_at

DiligenceReview
└── id, user_id, result (JSON checklist), source, created_at
```
