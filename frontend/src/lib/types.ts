// Mirrors backend/instructions/api/serializers.py. Change both in the same commit.
// Dates are ISO strings: "YYYY-MM-DD" for dates, full ISO 8601 for timestamps.

export interface User {
  id: number;
  username: string;
}

export interface Session {
  user: User;
  mock_mode: boolean;
}

export interface CsrfResponse {
  mock_mode: boolean;
}

export interface ApiErrorBody {
  error: string;
  fields?: Record<string, string[]>;
}

export type ReviewStatus = "machine" | "approved" | "missing";

export interface InstructionSummary {
  id: number;
  patient_label: string;
  follow_up_date: string | null;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  item_count: number;
  has_unreviewed: boolean;
}

export interface InstructionItem {
  id: number;
  template_key: string;
  title: string;
  english_text: string;
  swahili_text: string;
  values: Record<string, string>;
  audio_url: string | null;
  review_status: ReviewStatus;
  uses_fallback: boolean;
}

export interface InstructionDetail {
  id: number;
  patient_label: string;
  language: "swahili";
  follow_up_date: string | null;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
  patient_url: string;
  qr_url: string;
  has_unreviewed: boolean;
  items: InstructionItem[];
}

export interface DashboardResponse {
  recent_instructions: InstructionSummary[];
  unresolved_replies: number;
  mock_mode: boolean;
}

export interface InstructionListResponse {
  instructions: InstructionSummary[];
}

export interface TemplateInfo {
  key: string;
  title: string;
  english_text: string;
  placeholders: string[];
}

export type ValueRule =
  | { type: "text"; label: string; max_length: number }
  | { type: "integer"; label: string; min: number; max: number }
  | { type: "date"; label: string; source: "follow_up_date" };

export interface TemplatesResponse {
  templates: TemplateInfo[];
  value_rules: Record<string, ValueRule>;
}

export interface CreateInstructionPayload {
  patient_label: string;
  follow_up_date?: string;
  items: { template_key: string; values: Record<string, string | number> }[];
}

// ---- Patient (no login; token is the credential) ----

/** label_* key -> translated text. The backend already falls back to English when untranslated. */
export type Labels = Record<string, string>;

export interface PatientItem {
  id: number;
  template_key: string;
  text: string;
  audio_url: string | null;
  is_warning: boolean;
}

export interface PatientDigits {
  medicine: string | null;
  dose: string | null;
  times_per_day: string | null;
  days: string | null;
  return_date: string | null; // already DD/MM/YYYY
}

export interface PatientInstruction {
  patient_label: string;
  language: "swahili";
  follow_up_date: string | null;
  mock_mode: boolean;
  items: PatientItem[];
  digits: PatientDigits;
  labels: Labels;
}

/** 404 body for an unknown or expired link: labels let the screen explain it in Swahili. */
export interface PatientNotFoundBody {
  error: string;
  labels: Labels;
  mock_mode: boolean;
}

// ---- Replies ----

export type ReplyStatus = "pending" | "done" | "failed";

export interface ReplySubmitResponse {
  status: ReplyStatus;
}

/** Codes on a rejected reply upload; the patient screen maps them to translated labels. */
export type ReplyErrorCode = "consent_required" | "no_audio" | "too_large" | "not_audio" | "rate_limited";

export interface Reply {
  id: number;
  instruction_id: number;
  patient_label: string;
  created_at: string;
  status: ReplyStatus;
  translated_text: string;
  error: string;
  is_mock: boolean;
  is_resolved: boolean;
  audio_url: string;
}

export interface ReplyListResponse {
  replies: Reply[];
}
