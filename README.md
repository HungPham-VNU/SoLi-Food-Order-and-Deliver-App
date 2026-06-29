# 🍔 SoLi Food Delivery Platform

SoLi is a modern, high-performance, and robust Food Ordering & Delivery platform. It provides a complete ecosystem for customers to order food, restaurants to manage their menus and operations, and administrators to oversee platform analytics and payouts.

Built as a **Monorepo** using Turborepo, it strictly adheres to scalable architectural patterns (like CQRS and Event-Driven snapshots for core domains) and utilizes a state-of-the-art technology stack.

---

## 🚀 Features

### 🏢 Restaurant Management
* **Interactive Geocoding & Mapping:** Restaurants can accurately pinpoint their delivery zones and storefront locations using interactive Leaflet maps combined with the Photon Geocoding API.
* **Media Management:** Secure, direct-to-cloud uploads for menus and restaurant cover photos using Cloudinary.
* **Order Operations:** Real-time dashboards to accept, prepare, and dispatch orders.
* **Settings & Profiles:** Comprehensive settings allowing managers to tweak opening hours, addresses, notification preferences, and cuisine tags.

### 👑 System Administration "Mission Control"
* **"God's Eye" Overview:** Real-time tracking of Platform GMV, Revenue, and live operational stats.
* **Visual Analytics:** Interactive Recharts area graphs showing daily loads and revenue trends.
* **Live Heatmaps:** See exactly where orders are happening across the city via Leaflet heatmaps.
* **Restaurant Leaderboards:** Identify top earners and operational bottlenecks (e.g., high cancellation rates).

### 🛒 Customer Ordering (Upcoming/Core)
* Browse restaurants by delivery coverage (distance checking via PostGIS/Haversine).
* Real-time push notifications via native browser Notification APIs to track order status.

---

## 🛠️ Technology Stack

### Frontend (`apps/web`)
* **Framework:** React / Vite (TypeScript)
* **Design System:** Custom "Stitch Design System" using Tailwind CSS (`oklch` color spaces, glassmorphism, fluid typography).
* **UI Components:** Shadcn UI, Base UI (headless accessibility).
* **Data Fetching:** React Query (TanStack Query) & `react-hook-form` with Zod validation.
* **Mapping & Visuals:** `react-leaflet` (Leaflet.js), `recharts` for analytics.

### Backend (`apps/gateway`, `apps/services/*`)
* **Gateway:** NestJS public edge gateway on `http://localhost:8080`.
* **Services:** Identity, Media, Notification, Catalog, Promotion, Payment, Review, Ordering, and Reporting run as independent NestJS services.
* **Data ownership:** Each backend service owns its own PostgreSQL database boundary; Redis and RabbitMQ provide shared infrastructure where needed.
* **Communication:** Public HTTP enters through the gateway, then uses private TCP RPC and RabbitMQ domain events between services.

### Infrastructure & Tooling
* **Monorepo:** Turborepo (`pnpm` workspaces)
* **Cloud Services:** Cloudinary (Images), Photon API (Geocoding)
* **Linting/Formatting:** Prettier, ESLint

---

## 💻 Getting Started

### Prerequisites
* Node.js (v22+)
* pnpm (v11+)
* Docker Desktop for the full local backend stack

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/soli-food-delivery.git
   cd soli-food-delivery
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   Copy the example environment files and fill in your database and Cloudinary credentials.
   ```bash
   cp .env.example .env
   ```

4. **Run the full local stack:**
   ```bash
   docker compose -f docker-compose.dev.yml up --build --watch
   ```

5. **Or run services individually:**
   ```bash
   pnpm dev:gateway
   pnpm dev:identity
   pnpm dev:catalog
   pnpm dev:ordering
   pnpm dev:web
   ```

   * The Web App will be available at `http://localhost:5173`
   * The Admin App will be available at `http://localhost:5174`
   * The Gateway will be available at `http://localhost:8080`

---

## 🤝 Contributing
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
