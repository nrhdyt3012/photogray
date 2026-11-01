export type UserRole = 'owner' | 'cashier';
export type PaymentMethod = 'cash' | 'qris';
export type PrintLayout = 'half' | 'full';
export type TxnStatus = 'ready' | 'in_progress' | 'completed' | 'cancelled';

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string | null;
  is_active: boolean;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  branch_id: string | null;
  is_active: boolean;
}

export interface Room {
  id: string;
  branch_id: string;
  name: string;
  kiosk_code: string;
  is_active: boolean;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  photos_taken: number;
  photos_selected: number;
  print_layout: PrintLayout;
  is_active: boolean;
  sort_order: number;
}

export interface FrameRow {
  id: string;
  name: string;
  orientation: 'vertical' | 'horizontal';
  image_url: string;
  width: number;
  height: number;
  photo_slots: { x: number; y: number; width: number; height: number }[];
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Transaction {
  id: string;
  branch_id: string;
  room_id: string;
  cashier_id: string;
  package_id: string | null;
  package_name: string;
  price: number;
  photos_taken: number;
  photos_selected: number;
  print_layout: PrintLayout;
  payment_method: PaymentMethod;
  status: TxnStatus;
  photo_url: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface KioskStatus {
  found: boolean;
  room_name?: string;
  branch_name?: string;
  transaction?: {
    id: string;
    status: 'ready' | 'in_progress';
    package_name: string;
    photos_taken: number;
    photos_selected: number;
    print_layout: PrintLayout;
  } | null;
}
