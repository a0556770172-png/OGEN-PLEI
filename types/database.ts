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
  moderator_agreement_signed_at: string | null;
  notes: string | null;
  display_email: string | null;
  show_email_tag: boolean;
  can_like_override: boolean;
  can_comment_override: boolean;
  can_send_attachments: boolean;
  created_at: string;
}

export type DeletionRequestStatus = "pending" | "approved" | "rejected";

export interface UserDeletionRequest {
  id: string;
  target_user_id: string;
  requested_by: string;
  reason: string | null;
  status: DeletionRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  target?: Profile;
  requester?: Profile;
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
  admin_note: string | null;
  admin_note_at: string | null;
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
  started_by_staff: boolean;
  assigned_staff_id: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

// reactions: מפה של אימוג'י -> רשימת מזהי משתמשים שהגיבו בו (למשל { "👍": ["uuid1","uuid2"] })
export type MessageReactions = Record<string, string[]>;

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "user" | "staff";
  body: string;
  attachment_key: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  reply_to_id: string | null;
  reactions: MessageReactions;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender?: Profile;
  replyTo?: TicketMessage;
}

export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface AppSuggestion {
  id: string;
  suggested_by: string;
  app_name: string;
  app_link: string | null;
  version: string | null;
  note: string | null;
  file_key: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  status: SuggestionStatus;
  points_awarded: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_app_id: string | null;
  created_at: string;
  suggester?: Profile;
}

export type CouncilThreadStatus = "open" | "closed";

export interface CouncilThread {
  id: string;
  title: string;
  status: CouncilThreadStatus;
  opened_by: string;
  auto_approved: boolean;
  created_at: string;
  updated_at: string;
  opener?: Profile;
}

export interface CouncilMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  reply_to_id: string | null;
  reactions: MessageReactions;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender?: Profile;
  replyTo?: CouncilMessage;
}

export interface Category {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  created_at: string;
}
