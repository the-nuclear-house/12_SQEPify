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

export interface CompetencyScore {
  competency: string;
  current: number; // 0..5
  target: number; // the SQEP bar, normally 4
}

export interface PlannedTraining {
  id: string;
  name: string;
  competency: string;
  fromLevel: number;
  toLevel: number;
  startMonth: number; // months from plan start
  durationMonths: number;
  status: 'done' | 'in_progress' | 'upcoming';
}

export interface ConsultantProfileData {
  id: string;
  name: string;
  jobTitle: string | null;
  technicalDirector: string | null;
  competencies: CompetencyScore[];
  trainings: PlannedTraining[];
}

export interface Trainer {
  id: string;
  kind: 'technical_director' | 'consultant' | 'external';
  user_id: string | null;
  consultant_id: string | null;
  display_name: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CompetencyCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CompetencySubcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Competency {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  name: string;
  description: string | null;
  level_descriptors: Record<string, string> | null;
  sort_order: number;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  is_base: boolean;
  sort_order: number;
  created_at: string;
}

export interface RoleCompetency {
  role_id: string;
  competency_id: string;
  created_at: string;
}

export interface Training {
  id: string;
  title: string;
  competency_id: string;
  from_level: number;
  to_level: number;
  duration_days: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface TrainingDeliverer {
  training_id: string;
  trainer_id: string;
}
