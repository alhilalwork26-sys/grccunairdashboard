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
