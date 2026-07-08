export type Role =
  | "super_admin"
  | "manager"
  | "program_admin"
  | "kep_marketing"
  | "staff_kreatif"
  | "staff_marketing"
  | "kep_finance"
  | "staff_finance"
  | "staff_dokumen"
  | "kep_trainer"
  | "tim_riset";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
  is_active?: boolean;
  allowed_modules?: string[] | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: "pending" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string | null;
  created_by?: string | null;
  due_date?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
  requires_proof?: boolean;
  proof_url?: string | null;
  completion_note?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_note?: string | null;
}

export interface TaskLog {
  id: string;
  task_id: string;
  actor_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  proof_url: string | null;
  created_at: string;
  actor?: { full_name: string; role: string } | null;
}

export interface DailyProgress {
  id: string;
  user_id: string;
  date: string;
  morning_plan?: string | null;
  activities?: string | null;
  achievements?: string | null;
  obstacles?: string | null;
  plan_tomorrow?: string | null;
  mood?: number | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string; role: string } | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  type: "meeting" | "deadline" | "event" | "holiday" | "training";
  meet_link?: string | null;
  color?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | null;
}

export interface Document {
  id: string;
  title: string;
  description?: string | null;
  file_path: string;
  file_name: string;
  file_size?: number | null;
  file_type?: string | null;
  category: string;
  uploaded_by?: string | null;
  created_at: string;
  updated_at: string;
  is_locked?: boolean | null;
  password_hash?: string | null;
  profiles?: { full_name: string; role: string } | null;
}

export interface FinanceTransaction {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  description?: string | null;
  status: "pending" | "confirmed" | "cancelled";
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | null;
}

export interface Reimbursement {
  id: string;
  title: string;
  amount: number;
  description?: string | null;
  receipt_path?: string | null;
  category?: string | null;
  expense_date?: string | null;
  status: "pending" | "approved" | "rejected";
  payment_proof_url?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  requested_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
  requester?: { full_name: string; role: string } | null;
  reviewer?: { full_name: string } | null;
}

export interface Campaign {
  id: string;
  nama: string;
  deskripsi?: string | null;
  tujuan?: string | null;
  platform?: string[] | null;
  periode_mulai?: string | null;
  periode_selesai?: string | null;
  budget?: number | null;
  status: "planning" | "active" | "completed" | "cancelled";
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string } | null;
}

export interface ContentPost {
  id: string;
  campaign_id?: string | null;
  judul: string;
  platform: string;
  caption?: string | null;
  hashtags?: string | null;
  visual_url?: string | null;
  scheduled_date?: string | null;
  status: "draft" | "review" | "approved" | "rejected" | "posted";
  rejection_note?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string; role: string } | null;
  campaign?: { nama: string } | null;
}

export interface CreativeBrief {
  id: string;
  judul: string;
  deskripsi?: string | null;
  platform?: string | null;
  referensi_url?: string | null;
  deadline?: string | null;
  output_url?: string | null;
  status: "open" | "in_progress" | "delivered" | "revision" | "done";
  revision_note?: string | null;
  requested_by?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  requester?: { full_name: string; role: string } | null;
  assignee?: { full_name: string; role: string } | null;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  program_admin: "Program Admin",
  kep_marketing: "Kepala Marketing",
  staff_kreatif: "Staff Kreatif",
  staff_marketing: "Staff Marketing",
  kep_finance: "Kepala Finance",
  staff_finance: "Staff Finance",
  staff_dokumen: "Staff Dokumen",
  kep_trainer: "Kepala Trainer",
  tim_riset: "Tim Riset",
};
