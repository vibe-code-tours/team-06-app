// Shared type definitions for Restaurant QR Order System

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole =
  | 'super_admin'
  | 'restaurant_owner'
  | 'manager'
  | 'kitchen_staff'
  | 'waiter'
  | 'cashier'
  | 'customer';

export type TableStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'WAITING_PAYMENT'
  | 'CLEANING';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type OrderPaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export type SessionStatus = 'ACTIVE' | 'CLOSED' | 'RELEASED';

export type PaymentMethod = 'CASH' | 'CARD' | 'DIGITAL_WALLET';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  restaurant_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Table {
  id: string;
  restaurant_id: string;
  table_number: number;
  name: string | null;
  capacity: number;
  status: TableStatus;
  qr_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderSession {
  id: string;
  restaurant_id: string;
  table_id: string;
  started_at: string;
  closed_at: string | null;
  status: SessionStatus;
  created_at: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  table_session_id: string | null;
  table_id: string;
  customer_name: string | null;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  special_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  special_instructions: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  restaurant_id: string;
  amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  transaction_id: string | null;
  processed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// RATING TYPES
// ============================================================================

export interface OrderRating {
  id: string;
  order_id: string;
  restaurant_id: string;
  overall_rating: number;
  food_quality_rating: number | null;
  service_rating: number | null;
  feedback_text: string | null;
  created_at: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

// ============================================================================
// MENU API TYPES
// ============================================================================

export interface MenuResponse {
  restaurant: {
    id: string;
    name: string;
    logo_url: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    sort_order: number;
    items: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      image_url: string | null;
      is_available: boolean;
    }>;
  }>;
}

// ============================================================================
// ORDER API TYPES
// ============================================================================

export interface CreateOrderRequest {
  restaurant_id: string;
  table_id: string;
  customer_name?: string;
  special_instructions?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    special_instructions?: string;
  }>;
}

export interface CreateOrderResponse {
  order_id: string;
  session_id: string;
}

// ============================================================================
// PAYMENT API TYPES
// ============================================================================

export interface ProcessPaymentRequest {
  order_id: string;
  amount: number;
  tax_amount?: number;
  discount_amount?: number;
  payment_method: PaymentMethod;
  transaction_id?: string;
  notes?: string;
}

export interface ProcessPaymentResponse {
  payment_id: string;
  total_amount: number;
}
