export type ProductRole = 'superadmin' | 'technical_director' | 'consultant';

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  product_role: ProductRole;
  consultant_id: string | null;
  is_active: boolean;
}
