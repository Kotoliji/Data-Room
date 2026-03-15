# File size limits
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Token TTLs (seconds)
SESSION_TOKEN_MAX_AGE = 30 * 24 * 3600  # 30 days
PASSWORD_RESET_TOKEN_MAX_AGE = 1800  # 30 minutes
FILE_VIEW_TOKEN_MAX_AGE = 60  # 1 minute
OAUTH_STATE_MAX_AGE = 600  # 10 minutes
GOOGLE_AUTH_VERIFY_MAX_AGE = 120  # 2 minutes

# Google OAuth endpoints
GOOGLE_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"
