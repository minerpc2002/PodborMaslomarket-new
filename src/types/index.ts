export type FluidType = 'engine_oil' | 'atf' | 'mtf' | 'cvt' | 'dsg' | 'gear_oil' | 'transfer_case' | 'psf' | 'coolant' | 'brake_fluid';

export interface Product {
  id: string;
  brand_name: 'Ravenol' | 'Motul' | 'BARDAHL' | 'Moly Green';
  product_name: string;
  category: FluidType;
  viscosity: string;
  base_technology?: string;
  article_number?: string;
  approvals: string[];
  notes?: string;
  description?: string;
}

export interface Recommendation {
  unit: string;
  fluid_type: FluidType;
  factory_viscosity: string;
  recommended_viscosity: string;
  specification: string;
  approval: string;
  volume_liters: number;
  replacement_interval: string;
  products: Product[];
}

export interface CarData {
  id: string;
  brand: string;
  model: string;
  year_from: number;
  year_to: number;
  generation: string;
  engine: string;
  engine_code: string;
  engine_type: 'petrol' | 'diesel' | 'hybrid' | 'gas';
  drive: 'fwd' | 'rwd' | 'awd';
  transmission_type: 'mt' | 'at' | 'cvt' | 'dsg';
  recommendations: Recommendation[];
  search_type?: 'vin' | 'manual';
  isNew?: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  carId?: string;
  createdAt: number;
}

export interface BackgroundSearch {
  id: string;
  type: 'vin' | 'manual';
  query: string;
  status: 'searching' | 'completed' | 'error';
  createdAt: number;
}

export type UserRole = 'admin' | 'moderator' | 'pro' | 'user';

export interface SupportBan {
  expiresAt: number;
  reason: string;
  bannedAt: number;
}

export interface UserProfile {
  uid: string;
  nickname: string;
  email: string;
  role: UserRole;
  createdAt: number;
  activePromoCode?: PromoCode | null;
  activatedPromoCodes?: string[];
  supportBan?: SupportBan | null;
}

export interface PromoCode {
  code: string;
  expiresAt: number;
  maxAttempts: number;
  maxActivations: number;
  usedCount: number;
  createdBy: string;
  createdAt: number;
}

export interface AiModelConfig {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
}
