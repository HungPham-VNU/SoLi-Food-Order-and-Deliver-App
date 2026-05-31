# System Admin Dashboard Design Specification

## Overview
This document serves as the structural and aesthetic guide for generating the `AdminDashboardPage.tsx` using the **Stitch Design System**. This page acts as the platform owner's "Mission Control," providing a God's-eye view of platform revenue, restaurant performance, and system health all on a single page.

## Design Aesthetic (Stitch System)
- **Colors**: Rely on `oklch` palette variables defined in `index.css`. Use `bg-surface-container-lowest` for main cards and `bg-surface-container-low` for secondary nesting.
- **Typography**: `Plus Jakarta Sans` for headers/numbers, and `Inter` for body/labels.
- **Glassmorphism & Shadows**: Apply the `shadow-[0_4px_24px_rgba(0,0,0,0.04)]` ambient shadow to floating cards.
- **Micro-animations**: Include subtle hover states (`hover:bg-surface-container`, `transition-colors`) on interactive elements.

## Required Sections & Layout (Single Page Architecture)

### 1. The "God's Eye" Overview (KPI Cards)
**Layout:** 4-column grid spanning the top of the page.
- **Platform GMV:** Total Gross Merchandise Value (money flowing through the app). Use a vibrant icon (e.g., `paid`).
- **Platform Revenue:** Commission/Fees earned by the platform. Highlight with `--primary-container`.
- **Active Operations:** Live counts of "Restaurants Online" vs "Offline".
- **Order Success Rate:** Percentage of completed vs canceled orders. 

### 2. Live System Operations (Middle Section)
**Layout:** 2-column grid.
- **Live Platform Load (Chart) (col-span-1):**
  - **Component:** Use `recharts` to render a dynamic `AreaChart` representing hourly order volume and platform revenue.
  - **Styling:** Use a smooth gradient fill fading down to transparent.
- **System Heatmap (Map) (col-span-1):**
  - **Component:** Use `react-leaflet` (`MapContainer`, `TileLayer`, `CircleMarker`).
  - **Function:** Display a map of the city (e.g., Ho Chi Minh City) with scattered data points representing recent live orders.

### 3. Restaurant Management & Leaderboards (Bottom Section)
**Layout:** 3-column grid to hold various data tables/lists.
- **Top Earners (col-span-1):**
  - A ranked list of the top 5 performing restaurants by revenue. Display their logo, name, and total GMV.
- **Operational Bottlenecks (col-span-1):**
  - A "Watchlist" table highlighting restaurants with the highest *cancellation rates* or longest *preparation times*. Use warning colors (`text-error`, `bg-error/10`) for the badges.
- **Pending Approvals / Payouts (col-span-1):**
  - A combined queue showing new restaurants waiting for admin approval to go live, and a summary of pending weekly payouts. Add a "Review" button (`Button variant="secondary"`) for quick actions.

## Technical Requirements
- Build the layout fully responsive (stacking grids on mobile).
- Ensure components are modular. If the file gets too large, separate the charts and maps into sub-components, but keep the core logic wired in `AdminDashboardPage.tsx`.
- **Imports to utilize:**
  - `import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'`
  - `import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'`
  - Utilize standard Shadcn/Base UI components for dropdowns and buttons.
