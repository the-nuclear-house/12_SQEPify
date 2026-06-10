export type ProductRole = 'superadmin' | 'technical_director' | 'consultant';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  product_role: ProductRole;
  consultant_id: string | null;
  is_active: boolean;
  is_trainer?: boolean;
}

export interface DeliveryAssignment {
  plan_item_id: string;
  training_id: string;
  start_month: number;
  status: string;
  consultant_id: string;
  consultant_name: string;
  td_full_name: string | null;
  td_email: string | null;
  pending_month: number | null;
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
  status: 'done' | 'in_progress' | 'upcoming' | 'missing';
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
  required_level: number;
  created_at: string;
}

export interface Training {
  id: string;
  title: string;
  duration_hours: number | null;
  status: string;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface TrainingCompetency {
  training_id: string;
  competency_id: string;
  from_level: number;
  to_level: number;
}

export interface TrainingDeliverer {
  training_id: string;
  trainer_id: string;
}

export interface CompetencyLevelPath {
  competency_id: string;
  level: number;
  actions: string | null;
  verification: string | null;
}

export interface CompetencyLevelTraining {
  competency_id: string;
  level: number;
  training_id: string;
}

export interface PlanItem {
  id: string;
  assessment_id: string;
  competency_id: string | null;
  training_id: string | null;
  title: string | null;
  from_level: number;
  to_level: number;
  start_month: number | null;
  duration_months: number;
  kind: 'training' | 'missing';
  status: 'planned' | 'delivered' | 'assessed' | 'blocked';
  trainer_id: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  assessed_at: string | null;
  assessed_by: string | null;
  outcome_level: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export type AssessmentStatus =
  | 'draft'
  | 'self_assessment'
  | 'validation'
  | 'planning'
  | 'plan_review'
  | 'delivered'
  | 'cancelled';

export interface Assessment {
  id: string;
  consultant_id: string;
  status: AssessmentStatus;
  horizon_months: number;
  plan_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssessmentRole {
  assessment_id: string;
  role_id: string;
}

export interface AssessmentScore {
  assessment_id: string;
  competency_id: string;
  ai_level: number | null;
  self_level: number | null;
  validated_level: number | null;
  note: string | null;
  self_note: string | null;
}
