// Shared utility functions

import { format, parseISO } from 'date-fns';

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format currency amount
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date to readable string
 * @param dateString - ISO date string
 * @param formatStr - Date format pattern
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string,
  formatStr: string = 'MMM d, yyyy'
): string {
  return format(parseISO(dateString), formatStr);
}

/**
 * Format date and time
 * @param dateString - ISO date string
 * @returns Formatted datetime string
 */
export function formatDateTime(dateString: string): string {
  return format(parseISO(dateString), 'MMM d, yyyy h:mm a');
}

/**
 * Format time only
 * @param dateString - ISO date string
 * @returns Formatted time string
 */
export function formatTime(dateString: string): string {
  return format(parseISO(dateString), 'h:mm a');
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate email format
 * @param email - Email to validate
 * @returns true if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 * @param uuid - UUID to validate
 * @returns true if valid
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Convert string to slug
 * @param text - Text to slugify
 * @returns Slugified string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 * @param text - Text to capitalize
 * @returns Capitalized text
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert enum value to readable label
 * @param value - Enum value (e.g., 'PENDING')
 * @returns Readable label (e.g., 'Pending')
 */
export function enumToLabel(value: string): string {
  return value
    .split('_')
    .map(capitalize)
    .join(' ');
}

// ============================================================================
// NUMBER UTILITIES
// ============================================================================

/**
 * Calculate percentage
 * @param value - Current value
 * @param total - Total value
 * @returns Percentage (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Round to 2 decimal places
 * @param num - Number to round
 * @returns Rounded number
 */
export function roundTo2Decimals(num: number): number {
  return Math.round(num * 100) / 100;
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Group array by key
 * @param array - Array to group
 * @param key - Key to group by
 * @returns Grouped object
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, currentItem) => {
    const groupKey = String(currentItem[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(currentItem);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 * @param array - Array to sort
 * @param key - Key to sort by
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns Sorted array
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// ============================================================================
// ORDER STATUS UTILITIES
// ============================================================================

/**
 * Check if order status transition is valid
 * @param currentStatus - Current order status
 * @param newStatus - New order status
 * @returns true if transition is valid
 */
export function isValidOrderTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validTransitions: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Get next valid order statuses
 * @param currentStatus - Current order status
 * @returns Array of next valid statuses
 */
export function getNextOrderStatuses(currentStatus: string): string[] {
  const validTransitions: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  return validTransitions[currentStatus] ?? [];
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ORDER_STATUS_FLOW = [
  'PENDING',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'COMPLETED',
] as const;

export const TABLE_STATUS_FLOW = [
  'AVAILABLE',
  'OCCUPIED',
  'WAITING_PAYMENT',
  'CLEANING',
] as const;

export const PAYMENT_METHODS = ['CASH', 'CARD', 'DIGITAL_WALLET'] as const;

export const USER_ROLES = [
  'super_admin',
  'restaurant_owner',
  'manager',
  'kitchen_staff',
  'waiter',
  'cashier',
  'customer',
] as const;
