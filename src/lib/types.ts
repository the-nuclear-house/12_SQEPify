export type ProductRole = 'superadmin' | 'technical_director' | 'consultant';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  product_role: ProductRole;
  consultant_id: string | null;
  is_active: boolean;
}

export interface Consultant {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company_email: string | null;
  job_title: string | null;
  status: string | null;
  engineering_skills: string[];
  td_id: string | null;
  td_full_name: string | null;
  td_email: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  left_at: string | null;
  updated_at: string;
}
