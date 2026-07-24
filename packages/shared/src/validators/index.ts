import { z } from 'zod';

// ============================================================================
// AUTH VALIDATORS
// ============================================================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

// ============================================================================
// MENU VALIDATORS
// ============================================================================

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const menuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().default(''),
  price: z.number().positive('Price must be positive'),
  category_id: z.string().uuid('Invalid category ID'),
  image_url: z.string().url().optional().nullable(),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

// ============================================================================
// ORDER VALIDATORS
// ============================================================================

export const orderItemSchema = z.object({
  menu_item_id: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  special_instructions: z.string().optional(),
});

export const createOrderSchema = z.object({
  restaurant_id: z.string().uuid('Invalid restaurant ID'),
  table_id: z.string().uuid('Invalid table ID'),
  customer_name: z.string().optional(),
  special_instructions: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED',
  ]),
});

// ============================================================================
// PAYMENT VALIDATORS
// ============================================================================

export const processPaymentSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  amount: z.number().positive('Amount must be positive'),
  tax_amount: z.number().min(0).default(0),
  discount_amount: z.number().min(0).default(0),
  payment_method: z.enum(['CASH', 'CARD', 'DIGITAL_WALLET']),
  transaction_id: z.string().optional(),
  notes: z.string().optional(),
});

export const refundPaymentSchema = z.object({
  reason: z.string().min(1, 'Refund reason is required'),
});

// ============================================================================
// TABLE VALIDATORS
// ============================================================================

export const tableSchema = z.object({
  table_number: z.number().int().positive('Table number must be positive'),
  name: z.string().optional(),
  capacity: z.number().int().positive('Capacity must be at least 1').default(4),
  is_active: z.boolean().default(true),
});

export const updateTableStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'WAITING_PAYMENT', 'CLEANING']),
});

// ============================================================================
// RESTAURANT VALIDATORS
// ============================================================================

export const restaurantSchema = z.object({
  name: z.string().min(1, 'Restaurant name is required'),
  description: z.string().default(''),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  tax_rate: z.number().min(0).max(1).default(0),
});

// ============================================================================
// USER VALIDATORS
// ============================================================================

export const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  full_name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  role: z.enum([
    'super_admin',
    'restaurant_owner',
    'manager',
    'kitchen_staff',
    'waiter',
    'cashier',
    'customer',
  ]),
  restaurant_id: z.string().uuid().optional(),
});

export const inviteStaffSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['restaurant_owner', 'manager', 'kitchen_staff', 'waiter', 'cashier']),
});

export const acceptInviteSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(100).transform(s => s.trim()),
  phone: z.string().max(20).optional().default(''),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ============================================================================
// RATING VALIDATORS
// ============================================================================

export const rateOrderSchema = z.object({
  order_id: z.string().uuid('Invalid order ID'),
  overall_rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  food_quality_rating: z.number().int().min(1).max(5).optional(),
  service_rating: z.number().int().min(1).max(5).optional(),
  feedback_text: z.string().max(500, 'Feedback must be 500 characters or less').optional(),
});

// ============================================================================
// TYPES
// ============================================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type TableInput = z.infer<typeof tableSchema>;
export type RestaurantInput = z.infer<typeof restaurantSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type RateOrderInput = z.infer<typeof rateOrderSchema>;
