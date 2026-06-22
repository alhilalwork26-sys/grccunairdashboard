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
  | "kep_trainer";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
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
}

export interface DailyProgress {
  id: string;
  user_id: string;
  date: string;
  activities: string;
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
  status: "pending" | "approved" | "rejected";
  requested_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
  updated_at: string;
  requester?: { full_name: string; role: string } | null;
  reviewer?: { full_name: string } | null;
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
};
