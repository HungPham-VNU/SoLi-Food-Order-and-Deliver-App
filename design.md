# Dashboard Page Design Specification

## Overview
This document serves as the structural and aesthetic guide for generating the `DashboardPage.tsx` using the **Stitch Design System**. The dashboard acts as the primary operational hub for restaurant managers, integrating real-time analytics, order tracking, and core administrative controls.

## Design Aesthetic (Stitch System)
- **Colors**: Rely on `oklch` palette variables defined in `index.css`. Use `bg-surface-container-lowest` for main cards and `bg-surface-container-low` for secondary nesting. Primary actions and key metrics should utilize `--primary` (`#0d631b`) and `--primary-container`.
- **Typography**: `Plus Jakarta Sans` for headers/numbers, and `Inter` for body/labels.
- **Glassmorphism & Shadows**: Apply the `shadow-[0_4px_24px_rgba(0,0,0,0.04)]` ambient shadow to floating cards.
- **Micro-animations**: Include subtle hover states (`hover:bg-surface-container`, `transition-colors`, etc.) on interactive elements.

## Required Sections & Layout

### 1. Global Control Bar (Top Section)
**Layout:** Grid spanning 12 columns.
- **Store Status (col-span-8):**
  - Displays whether the store is currently accepting orders.
  - Controls: Two pill-shaped buttons ("Open", "Closed") toggling the store state.
  - Visuals: Use a storefront icon (`material-symbols-outlined`) in a `bg-primary/10` rounded square.
- **Audio Alerts (col-span-4):**
  - Toggles global audio notifications (mute/unmute).
  - Displays a mini-alert if there are urgent orders waiting (`> 10 min`).

### 2. High-Level KPIs (Replacing System Connectivity)
**Layout:** 4-column grid (or flex wrap for mobile).
- **In Progress (Active Orders):** Large typography metric pulled from the real-time `useOrderCounts` hook. Use `bg-primary-container`.
- **Outbound (Ready for Pickup):** Large typography metric. Use `bg-secondary-container`.
- **Financial KPIs:** Two additional cards for:
  1. **Today's Revenue:** Format as currency.
  2. **Average Order Value (AOV):** Format as currency.
  *(These cards should replace the previous "System Connectivity" widget and hook into the `/api/analytics` endpoint).*

### 3. Visual Data & Actionable Lists (Bottom Section)
**Layout:** 3-column grid.
- **Daily Revenue / Active Load Chart (col-span-2):**
  - **Component:** Use `recharts` to render a dynamic AreaChart or BarChart representing hourly revenue or order volume.
  - **Styling:** The chart should use the primary color (`--primary`) with a gradient fill (opacity fading down).
  - **Header:** "Daily Load & Revenue".
- **Urgent & Recent Orders (col-span-1):**
  - **Component:** A vertically scrollable list replacing the old "Staff Availability" demo.
  - **Data:** Map through the top 3-5 most recent or urgent orders from the `useOrders` store.
  - **Items:** Each row should display the Order ID, Time Waiting (e.g., "12 min ago"), and Total Price. Add a "View" button (`Button variant="ghost"`) to jump to the order details.

## Technical Requirements
- Ensure all numbers and charts reflect real data endpoints, handling loading states gracefully.
- Avoid hardcoded "Demo" data. Fallback to empty states (e.g., "No recent orders") when arrays are empty.
- **Imports to utilize:**
  - `import { useMyRestaurant, useUpdateRestaurant } from '@/features/restaurant/hooks/useRestaurants'`
  - `import { useOrderCounts } from '@/features/dashboard/hooks/useOrderCounts'`
  - `import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts'` (for analytics graph)
