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
