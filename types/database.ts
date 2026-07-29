// "moderator" נשאר בטיפוס מטעמי תאימות לאחור בלבד (שדה role ישן) - אין ליצור עוד ערך כזה.
// פיקוח מיוצג כעת דרך is_moderator, שמתווסף על גבי role (user/developer/admin) ולא מחליף אותו.
export type UserRole = "user" | "developer" | "admin" | "moderator";
export type AppStatus = "pending" | "approved" | "rejected" | "archived";
export type ProStatus = "none" | "requested" | "approved" | "rejected";

export interface Profile {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  is_moderator: boolean;
  avatar_key: string | null;
  is_pro: boolean;
  pro_status: ProStatus;
  points: number;
  banned: boolean;
  accepted_terms_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface AppRow {
  id: string;
  developer_id: string;
  name: string;
  short_description: string;
  description_html: string;
  version: string;
  category: string;
  icon_key: string | null;
  file_key: string;
  file_name: string;
  file_size_bytes: number;
  status: AppStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  downloads_count: number;
  download_paused: boolean;
  download_paused_until: string | null;
  created_at: string;
  updated_at: string;
  developer?: Profile;
}

export interface ProRequest {
  id: string;
  developer_id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  admin_message: string | null;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  developer?: Profile;
}

export type TicketStatus = "open" | "closed";

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "user" | "staff";
  body: string;
  created_at: string;
  sender?: Profile;
}

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface AppSuggestion {
  id: string;
  suggested_by: string;
  app_name: string;
  app_link: string | null;
  note: string | null;
  file_key: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  status: SuggestionStatus;
  points_awarded: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  suggester?: Profile;
}

export interface Category {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  created_at: string;
}
