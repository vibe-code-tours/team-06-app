# QR Dine — User Guide

<p align="center">
  <em>A complete QR-based restaurant ordering platform for customers, kitchen staff, waiters, cashiers, managers, owners, and super admins.</em>
</p>

---

## Table of Contents

1. [Overview](#1-overview)
2. [Customer Guide](#2-customer-guide)
3. [Kitchen Staff Guide](#3-kitchen-staff-guide)
4. [Waiter / Staff Guide](#4-waiter--staff-guide)
5. [Cashier Guide](#5-cashier-guide)
6. [Manager Guide](#6-manager-guide)
7. [Restaurant Owner Guide](#7-restaurant-owner-guide)
8. [Super Admin Guide](#8-super-admin-guide)
9. [Troubleshooting](#9-troubleshooting)
10. [Glossary](#10-glossary)

---

## 1. Overview

**QR Dine** is a cloud-based ordering system that lets restaurant customers scan a QR code at their table to browse the menu, place orders, and pay — all from their own phone. Staff members manage orders through role-specific dashboards that update in real time.

### 1.1 How It Works

```
Customer scans QR code at table
        │
        ▼
Digital menu opens on phone
        │
        ▼
Customer browses categories, selects items, adds notes
        │
        ▼
Order sent to kitchen in real time
        │
        ▼
Kitchen staff updates order status (Accept → Preparing → Ready)
        │
        ▼
Waiter delivers order; customer can request bill
        │
        ▼
Cashier processes payment → table released
```

### 1.2 User Roles at a Glance

| Role | What They Do |
|------|-------------|
| **Customer** | Scan QR, browse menu, place orders, track status, pay |
| **Kitchen Staff** | View incoming orders, update preparation status |
| **Waiter** | Monitor tables, assist customers, manage table status |
| **Cashier** | Process payments, issue refunds, generate receipts |
| **Manager** | Oversee orders, staff scheduling, daily operations |
| **Restaurant Owner** | Manage menu, tables, staff, settings, and reports |
| **Super Admin** | Manage all restaurants, users, and system settings |

---

## 2. Customer Guide

### 2.1 Getting Started

1. **Scan the QR code** at your table using your phone's camera or a QR scanner app.
2. The restaurant's **digital menu** opens automatically in your browser — no app download needed.
3. You'll see the restaurant name and logo at the top, with menu items organized by category.

### 2.2 Browsing the Menu

- **Categories**: Tap a category tab (e.g., "Appetizers", "Main Course", "Desserts") to filter items.
- **Item details**: Each item shows its name, description, price, and photo.
- **Availability**: Unavailable items are greyed out and cannot be ordered.
- **Scroll** through the full menu at your own pace — there is no rush.

### 2.3 Placing an Order

1. Tap the **+** button on any item to add it to your cart.
2. Adjust quantities using the **+** and **−** buttons.
3. Tap **Special Instructions** on any item to add notes (e.g., "no onions", "extra spicy").
4. When ready, tap **Review Order** at the bottom of the screen.
5. Confirm your items, quantities, and any special instructions.
6. Tap **Place Order** to send it to the kitchen.

> **Note**: Your order is linked to your table. Only one active session per table is allowed — if you have an unpaid bill, new orders will be blocked until it's settled.

### 2.4 Tracking Your Order

After placing an order, you'll see its status update in real time:

```
PENDING    →    ACCEPTED    →    PREPARING    →    READY    →    COMPLETED
```

Each status change appears live on your screen — no need to refresh.

| Status | What It Means |
|--------|---------------|
| **PENDING** | Your order has been submitted and is waiting for the kitchen to accept it |
| **ACCEPTED** | The kitchen has acknowledged your order and will begin preparing it soon |
| **PREPARING** | Your food is being cooked or assembled |
| **READY** | Your order is ready to be served |
| **COMPLETED** | Your order has been delivered and the bill is settled |

### 2.5 Requesting the Bill

1. When you're ready to pay, tap **Request Bill** from the order screen.
2. The system notifies staff that your table is waiting for payment.
3. A waiter or cashier will come to your table to process payment.

### 2.6 Payment

Payment is handled by restaurant staff (cashier or waiter). The following methods are accepted:

- **Cash**
- **Card** (credit / debit)
- **Digital Wallet** (e.g., Apple Pay, Google Pay, Line Pay)

After successful payment, your session is closed, and the table becomes available for the next guests.

---

## 3. Kitchen Staff Guide

### 3.1 Accessing the Kitchen Dashboard

1. Go to the login page and sign in with your staff credentials.
2. You are automatically redirected to the **Kitchen Dashboard**.

### 3.2 Understanding the Order Queue

The kitchen dashboard displays orders in a real-time feed:

- **New orders** appear at the top with a highlighted background.
- Orders are **grouped by table** so you can prepare all items for one table together.
- Each order card shows:
  - **Table number**
  - **Order time**
  - **Item names and quantities**
  - **Special instructions** (highlighted for attention)

### 3.3 Updating Order Status

Each order has a status that you advance through as you work:

1. **Accept** — Tap to acknowledge the order. This changes status from PENDING → ACCEPTED.
   - Always accept orders promptly so customers know their order is being handled.
2. **Preparing** — Tap when you begin cooking. Status changes to PREPARING.
3. **Ready** — Tap when the order is plated and ready for service. Status changes to READY.
   - Staff are notified automatically when an order is marked ready.

> **Important**: You cannot skip statuses (e.g., go directly from ACCEPTED to READY). Each step must be completed in order.

### 3.4 Tips for Efficient Workflow

- **Accept orders promptly** to reassure customers their order is being handled.
- **Check special instructions** on every order before starting preparation.
- **Mark as Ready** as soon as the order is plated so waiters can serve it while hot.
- Use the **table grouping** to prepare complete table orders together.

---

## 4. Waiter / Staff Guide

### 4.1 Accessing the Staff Dashboard

1. Sign in with your staff credentials.
2. You are redirected to the **Staff Dashboard** showing the restaurant floor at a glance.

### 4.2 Table Status Overview

The main view is a grid of all tables, each color-coded by status:

| Status | Color | Meaning |
|--------|-------|---------|
| **Available** | Green | Table is empty and ready for guests |
| **Occupied** | Orange | Guests are seated and have an active order session |
| **Waiting Payment** | Purple | Guests have requested the bill |
| **Cleaning** | Gray | Table is being cleaned after guests have left |

### 4.3 Managing Tables

- **View table details**: Tap any table to see its current order status and history.
- **Mark as Cleaning**: After guests leave and payment is settled, mark the table as CLEANING.
- **Mark as Available**: After cleaning, mark the table as AVAILABLE for new guests.

### 4.4 Using Dashboard Tabs

The dashboard has several tabs to help you stay organized:

| Tab | What You'll See |
|-----|----------------|
| **Active Orders** | Orders currently being prepared in the kitchen |
| **Waiting Payment** | Tables where guests have requested the bill |
| **Completed Orders** | Today's fulfilled orders for reference |

All tabs update in real time — no manual refresh needed.

### 4.5 Assisting Customers

- **Order help**: If a customer needs help ordering, you can guide them through the digital menu on their phone.
- **Special requests**: If a customer has a special request not covered by the digital menu, coordinate with the kitchen directly.
- **Bill requests**: When a table is marked as WAITING PAYMENT, direct a cashier to process the bill.

---

## 5. Cashier Guide

### 5.1 Accessing the Cashier Panel

1. Sign in with your cashier credentials.
2. You are redirected to the **Cashier Panel**.

### 5.2 Processing a Payment

1. **Find the order**: The WAITING PAYMENT tab shows all tables awaiting payment.
2. **Review the bill**: The bill summary displays:
   - Itemized list of ordered items
   - Subtotal
   - Tax (calculated based on restaurant settings)
   - Discounts (if applicable)
   - Grand total
3. **Select payment method**: Choose from Cash, Card, or Digital Wallet.
4. **Confirm payment**: Tap **Process Payment** to complete the transaction.

After successful payment:
- The payment record is saved with transaction ID, amount, method, and your cashier ID.
- The order status auto-updates to COMPLETED.
- The table session is closed.
- The table becomes ready for its next status transition (AVAILABLE or CLEANING).

### 5.3 Issuing a Refund

1. Find the completed order in the payment history.
2. Tap **Refund**.
3. Enter the **refund reason** (required).
4. Confirm the refund.

The refund is recorded with the reason, and the payment status is updated to REFUNDED.

### 5.4 Generating Receipts

After payment, you can generate an itemized receipt that includes:

- Restaurant name and logo
- Table number
- Date and time
- Itemized order list
- Subtotal, tax, discounts
- Payment method
- Transaction ID
- Cashier name

---

## 6. Manager Guide

### 6.1 Accessing the Manager Dashboard

1. Sign in with your manager credentials.
2. You are redirected to the **Manager Dashboard** with an overview of restaurant operations.

### 6.2 Dashboard Overview

The manager dashboard provides:

- **Real-time order feed**: All active orders across the restaurant.
- **Table status grid**: Complete view of all tables and their statuses.
- **Staff overview**: Which staff members are currently on shift.
- **Quick stats**: Today's order count, revenue, and table turnover.

### 6.3 Operational Controls

| Action | How To |
|--------|--------|
| Monitor orders | View all active orders with real-time status updates |
| Manage tables | Update table status, view table history |
| View staff | See the staff list and their assigned roles |
| Daily reports | Access daily sales summaries and performance metrics |

### 6.4 Reports

The manager can view:

- **Daily sales summary**: Total revenue, order count, average order value.
- **Popular items**: Most ordered items, peak ordering times.
- **Table turnover**: Average dining duration, table utilization rates.

---

## 7. Restaurant Owner Guide

### 7.1 Accessing the Owner Dashboard

1. Sign in with your restaurant owner credentials.
2. You are redirected to the **Owner Dashboard** with full restaurant management controls.

### 7.2 Menu Management

#### Categories

| Action | How To |
|--------|--------|
| **Add category** | Go to Menu → Categories → Add Category. Enter name and sort order. |
| **Edit category** | Tap the category and update its name or sort order. |
| **Delete category** | Tap Delete. Note: categories with items cannot be deleted until items are removed. |
| **Reorder categories** | Use drag-and-drop to rearrange how categories appear on the customer menu. |

#### Menu Items

| Action | How To |
|--------|--------|
| **Add item** | Go to Menu → Items → Add Item. Fill in name, description, price, and select a category. |
| **Upload image** | Tap the image field to upload a photo from your device. |
| **Edit item** | Tap any item to update its details, price, or category. |
| **Toggle availability** | Use the availability switch to quickly show or hide an item from customers. |
| **Delete item** | Tap Delete to permanently remove an item from the menu. |

### 7.3 Table Management

| Action | How To |
|--------|--------|
| **Add table** | Go to Tables → Add Table. Enter the table number/label. A QR code is auto-generated. |
| **Edit table** | Tap a table to update its label or number. |
| **Delete table** | Tap Delete to remove the table from the system. |
| **View QR code** | Each table has a unique QR code. Tap to view and download. |
| **Download QR (single)** | Tap **Download QR** to save an individual table's QR as a PNG. |
| **Download QR (batch)** | Tap **Download All** to export all table QR codes at once for printing. |
| **Regenerate QR codes** | If QR codes are compromised, use **Regenerate All** to create new codes for all tables. |

### 7.4 Staff Management

| Action | How To |
|--------|--------|
| **Invite staff** | Go to Staff → Invite. Enter the staff member's email and select their role. An invitation email is sent automatically. |
| **Change role** | Tap a staff member and select a new role from the dropdown. |
| **Deactivate staff** | Tap Deactivate to remove a staff member's access. Their account is disabled but preserved for records. |
| **View staff list** | See all staff members, their roles, and status (active/inactive). |

### 7.5 Business Settings

| Setting | Description |
|---------|-------------|
| **Restaurant name** | Displayed on customer menu and receipts |
| **Contact info** | Phone number and email for customer inquiries |
| **Tax rate** | Percentage applied to all orders automatically |
| **Business hours** | Operating hours per day of the week |
| **Logo** | Upload your restaurant logo — displayed on the customer menu and QR codes |

### 7.6 Reports & Analytics

- **Sales reports**: Daily, weekly, and monthly revenue summaries.
- **Popular items**: Ranked list of most-ordered items.
- **Peak hours**: Identify busy periods for staff scheduling.
- **Export data**: Download reports as CSV for external analysis.

---

## 8. Super Admin Guide

### 8.1 Accessing Super Admin

1. Sign in with your super admin credentials.
2. You are redirected to the **Super Admin Dashboard** with system-wide controls.

### 8.2 Restaurant Management

| Action | How To |
|--------|--------|
| **Create restaurant** | Go to Restaurants → Add Restaurant. Enter name, contact info, and settings. |
| **View all restaurants** | See a list of all restaurants with key stats (active orders, revenue, staff count). |
| **Edit restaurant** | Tap any restaurant to update its details. |
| **Activate / Deactivate** | Toggle a restaurant's active status. Deactivated restaurants are hidden from public view. |
| **Delete restaurant** | Soft-delete (deactivate) or permanently delete a restaurant. |

### 8.3 User Management

| Action | How To |
|--------|--------|
| **View all users** | See all users across all restaurants, including their roles. |
| **Create user** | Create a user account with any role for any restaurant. |
| **Change user role** | Update any user's role across the system. |
| **Deactivate user** | Disable any user account. |

### 8.4 System-Wide Oversight

- **Cross-restaurant monitoring**: View active orders, revenue, and status across all restaurants.
- **Staff overview**: See all staff members across all restaurants.
- **System settings**: Configure global system parameters.

---

## 9. Troubleshooting

### 9.1 Customer Issues

| Problem | Solution |
|---------|----------|
| **QR code won't scan** | Ensure good lighting. Clean the QR code. Use your phone's default camera app (most have built-in QR scanning). |
| **Menu won't load** | Check your internet connection. Try refreshing the page. Notify a staff member if the issue persists. |
| **Can't place an order** | Your table may have an existing unpaid session. Ask a staff member to resolve it. |
| **Order status not updating** | Try refreshing the page. The system uses real-time updates — a refresh usually resolves display issues. |

### 9.2 Staff Issues

| Problem | Solution |
|---------|----------|
| **Can't log in** | Verify your credentials. Contact your manager or owner to reset your password. Ensure your account is active. |
| **Dashboard not updating** | Check your internet connection. Try refreshing the page. The dashboard uses WebSocket connections — a refresh re-establishes the connection. |
| **Can't update order status** | Ensure you are following the correct status sequence. You cannot skip states (e.g., PENDING → PREPARING without ACCEPTED first). |
| **Can't see certain features** | Your role determines what you can access. If you need additional permissions, contact your restaurant owner or manager. |

### 9.3 Owner / Admin Issues

| Problem | Solution |
|---------|----------|
| **Staff not receiving invites** | Check the email address. Ask the staff member to check their spam folder. Verify the Supabase Auth email settings. |
| **Menu changes not visible** | Availability toggles take effect immediately. If changes aren't visible, refresh the customer menu page. |
| **QR codes not printing correctly** | Ensure you're downloading as PNG. Check printer settings for quality output. |
| **Reports seem incorrect** | Verify the date range. Check that all payments were processed correctly. Ensure no orders are stuck in an incomplete state. |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Active Session** | A table's current dining session. Only one active session per table at a time. |
| **Bill** | A summary of ordered items, subtotal, tax, discounts, and total amount due. |
| **Category** | A grouping of menu items (e.g., Appetizers, Main Course, Desserts). |
| **Menu Item** | An individual product available for order (name, description, price, image). |
| **Order** | A set of one or more menu items placed by a customer at a table. |
| **Order Status** | The current stage of an order: PENDING → ACCEPTED → PREPARING → READY → COMPLETED. |
| **Payment Method** | How the bill is paid: Cash, Card, or Digital Wallet. |
| **QR Code** | A scannable code unique to each table that opens the digital menu. |
| **Realtime** | Live updates via WebSocket — dashboards refresh automatically without page reload. |
| **RLS (Row Level Security)** | Database security that ensures users can only access data they're permitted to see. |
| **Session** | The period from when a table is first seated to when the bill is paid and the table is released. |
| **Table Status** | Current state of a table: Available, Occupied, Waiting Payment, or Cleaning. |

---

<p align="center">
  <strong>QR Dine</strong> — Restaurant QR Order System
  <br>
  Need help? Contact your restaurant manager or system administrator.
</p>
