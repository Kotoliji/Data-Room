import type { SensitiveFlag } from "./types"

export const SENSITIVE_LABELS: Record<SensitiveFlag["kind"], string> = {
  personal_ids: "Personal IDs",
  compensation: "Compensation",
  bank_details: "Bank details",
  health: "Health data",
  credentials: "Credentials",
}
