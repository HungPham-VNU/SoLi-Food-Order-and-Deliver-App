**Vision and Scope Document**

**Food Delivery Platform**

*Nền tảng Đặt và Giao Đồ ăn Trực tuyến*

Version 1.0

January 28, 2026

**Revision History**

| **Name** | **Date** | **Reason For Changes** | **Version** |
| --- | --- | --- | --- |
| Development Team | 28/01/2026 |  | 1.0 |

# **1. Business Requirements**

## **1.1. Background**

The food and beverage service industry in Vietnam is experiencing rapid digital transformation. Currently, consumers who wish to order food must either visit restaurants in person, make phone calls, or rely on fragmented third-party services that offer limited restaurant choices and inconsistent delivery experiences. Restaurants lack a centralized platform to efficiently manage orders and reach a broader customer base. Delivery personnel do not have a structured system to optimize their routes and income. These inefficiencies result in wasted time for customers, lost revenue for restaurants, and suboptimal operational performance across the supply chain.

Existing platforms such as GrabFood, ShopeeFood, and Baemin have demonstrated the viability and growth potential of the food delivery marketplace model in Vietnam. However, there remains a need for a well-architected, scalable platform that can serve as both a practical solution and an academic reference for modern multi-role web application development.

## **1.2. Business Opportunity**

The Food Delivery Platform presents the opportunity to build a comprehensive multi-role marketplace that connects three core participants in the food delivery value chain: customers (food orderers), restaurants (food providers), and delivery personnel (shippers). The platform will streamline the entire process from order placement to successful delivery. By automating order processing, real-time tracking, and payment management, the system will significantly improve operational efficiency for all stakeholders. The platform also opens opportunities for future expansion into grocery delivery, pharmacy delivery, and other on-demand services.

## **1.3. Business Objectives**

BO-1: Reduce average customer time spent ordering food by 50% within 6 months following initial release.

Scale: Average time from food selection to order confirmation

Meter: System-recorded timestamps per order session

Goal: Under 5 minutes from browsing to order confirmation

Stretch: Under 3 minutes

BO-2: Enable restaurants to increase their daily order volume by 30% within 12 months following initial release by providing access to a wider digital customer base.

BO-3: Achieve a delivery success rate of 95% or higher within 6 months following initial release by optimizing dispatch and routing logic.

BO-4: Process online payments (VNPay, MoMo) for at least 70% of all orders within 6 months following initial release.

## **1.4. Success Metrics**

SM-1: At least 500 registered customers actively place orders at least once per week within 3 months following initial release.

SM-2: At least 30 restaurant partners are onboarded and actively processing orders within 3 months following initial release.

SM-3: Average customer satisfaction rating of 4.0 or higher (on a scale of 1 to 5) based on post-delivery reviews within 6 months following initial release.

SM-4: Average order-to-delivery time does not exceed 45 minutes for orders within the designated service zone within 6 months following initial release.

## **1.5. Vision Statement**

For customers who want to quickly and conveniently order food from restaurants or have meals delivered to their door, the Food Delivery Platform is an Internet-based and mobile-enabled multi-role application that connects customers, restaurants, and delivery personnel in a seamless marketplace ecosystem. Unlike fragmented or manual ordering processes, the Food Delivery Platform provides real-time order tracking, integrated online payments, automated dispatch, and comprehensive management dashboards for all participants – enabling customers to save time, helping restaurants grow their reach, and providing flexible earning opportunities for delivery staff.

## **1.6. Business Risks**

RI-1: Competition from established platforms (GrabFood, ShopeeFood, Baemin) may hinder user adoption. (Probability = 0.7; Impact = 8)

RI-2: Insufficient number of restaurant partners onboarded at launch may reduce platform utility for customers. (Probability = 0.5; Impact = 9)

RI-3: Delivery personnel shortage during peak hours may result in delayed deliveries and poor customer experience. (Probability = 0.5; Impact = 7)

RI-4: Integration failures with payment gateways (VNPay, MoMo) may disrupt the transaction flow and reduce user trust. (Probability = 0.3; Impact = 8)

RI-5: Real-time tracking features may face performance degradation under high concurrency load if WebSocket infrastructure is not properly scaled. (Probability = 0.4; Impact = 6)

## **1.7. Business Assumptions and Dependencies**

AS-1: Smartphones and internet access are available to customers, restaurant staff, and delivery personnel.

AS-2: Restaurant partners will maintain up-to-date menus and operating hours on the platform.

AS-3: Payment gateway providers (VNPay, MoMo) will maintain API availability with at least 99.5% uptime.

AS-4: A minimum viable pool of delivery personnel will be available in the target service area at launch.

DE-1: Map and geolocation functionality depends on the availability and quotas of the selected map API provider (Google Maps or Mapbox).

DE-2: Real-time order tracking depends on continuous WebSocket connectivity between the server and client devices.

# **2. Scope and Limitations**

## **2.1. Major Features**

FE-1: Customer registration, login, and profile management (email and OAuth authentication).

FE-2: Restaurant search and browsing by name, food category, and geographic location.

FE-3: Shopping cart management and checkout with delivery address input.

FE-4: Online payment processing via VNPay and MoMo payment gateways.

FE-5: Real-time order status tracking with map-based delivery personnel location updates.

FE-6: Restaurant management portal: menu management, order reception, preparation status updates.

FE-7: Delivery personnel portal: availability management, order acceptance, delivery confirmation.

FE-8: Administrator dashboard: user management, restaurant and shipper approval, revenue reporting.

FE-9: Customer review and rating system for restaurants and delivery personnel.

FE-10: Promotional features: discount codes, flash sales, and loyalty points.

FE-11: Multi-branch restaurant management and scheduled/group order capabilities.

FE-12: Push notifications for order updates across all roles.

## **2.2. Scope of Initial and Subsequent Releases**

| **Feature** | **Release 1 (MVP)** | **Release 2** | **Release 3** |
| --- | --- | --- | --- |
| **FE-1 to FE-3, Customer Core** | Full registration, search, cart, checkout with COD or VNPay payment | Save multiple addresses; refine payment UX | Loyalty points, group orders, scheduled orders |
| **FE-4, Online Payment** | VNPay integrated | MoMo integrated | Additional e-wallet support (ZaloPay) |
| **FE-5, Real-time Tracking** | Basic order status updates | Full map-based live tracking via WebSocket | Predictive ETA using ML model |
| **FE-6, Restaurant Portal** | Menu management, order acceptance, preparation status | Flash sales, ingredient/stock management, multi-branch | Advanced analytics and BI dashboard |
| **FE-7, Shipper Portal** | Availability toggle, order pickup, delivery confirmation | Earnings statistics, customer ratings view | Route optimization with ML-assisted dispatch |
| **FE-8, Admin Dashboard** | User management, approvals, basic revenue report | Heat maps, promo management, real-time monitoring | Full BI integration and fraud detection |
| **FE-9 to FE-12, Enhancements** | Basic review and rating | Push notifications, discount codes, multi-branch | Chatbot, image search, mobile apps (iOS/Android) |

## **2.3. Limitations and Exclusions**

LI-1: The initial release of the platform will serve only a single designated geographic area (city or district). Expansion to additional regions is planned for subsequent releases.

LI-2: Release 1 supports both Cash on Delivery (COD) and online payments via VNPay. Additional online payment gateways (e.g., MoMo) may be introduced in subsequent releases.

LI-3: AI/ML-powered features (personalized recommendations, image search, fraud detection, predictive delivery ETA) are excluded from Releases 1 and 2 and are designated as long-term roadmap items.

LI-4: B2B enterprise ordering and subscription meal plan features are out of scope for all planned releases.

# **3. Business Context**

## **3.1. Stakeholder Profiles**

| **Stakeholder** | **Major Value** | **Attitudes** | **Major Interests** | **Constraints** |
| --- | --- | --- | --- | --- |
| **Customers** | Fast, convenient food ordering; wider food choices; time savings | High enthusiasm; may reduce usage if delivery times are inconsistent | Ease of use; reliable and timely delivery; transparent pricing | Requires smartphone or internet-connected device |
| **Restaurant Partners** | Expanded customer reach; increased order volume; brand visibility | Receptive but concerned about commission rates and integration effort | Minimal technical overhead; reliable order flow; fair revenue sharing | Staff training required; need stable internet connection in kitchen |
| **Delivery Personnel (Shippers)** | Flexible income; transparent earnings and incentives | Positive about flexible work; concerned about fair order dispatch | Efficient route assignment; accurate earnings tracking; fair ratings | Requires smartphone with GPS and mobile internet |
| **Platform Administrators** | Centralized control over platform operations and quality | Strongly committed to platform success; quality-focused | Operational efficiency; fraud prevention; platform growth metrics | Limited initial staff; manual review processes during early launch |
| **Payment Gateway Providers (VNPay, MoMo)** | Transaction volume and partnership revenue | Cooperative; standard integration procedures apply | API stability; compliance with financial regulations | Integration must follow their official API documentation and sandbox testing |
| **Development Team** | Technical knowledge growth; portfolio project completion | Motivated; may face challenges with real-time and payment integration | Clear requirements; well-defined architecture; realistic scope | Academic timeline; limited team size; varying skill levels |

## **3.2. Project Priorities**

| **Dimension** | **Constraint** | **Driver** | **Degree of Freedom** |
| --- | --- | --- | --- |
| **Features** | All MVP features (FE-1 to FE-8 core functionality) must be fully operational in Release 1 |  |  |
| **Quality** | 90% of user acceptance tests must pass; all authentication and payment security tests must pass |  |  |
| **Schedule** |  |  | Release 1 planned for end of semester; overrun of up to 2 weeks acceptable without scope reduction |
| **Cost** |  |  | Infrastructure costs must stay within student project budget; free-tier cloud services preferred |
| **Staff** |  | Team size is defined by academic group assignment (3–5 members); roles include BA, frontend, backend, and DevOps |  |

## **3.3. Deployment Considerations**

The platform will be deployed using Docker containers orchestrated via Docker Compose for the initial release. A cloud platform (AWS, Google Cloud, or Azure) will be used for hosting, with free-tier or student-tier resources utilized where possible to manage costs.

The backend will be built on NestJS (Node.js) with PostgreSQL as the primary relational database and Redis for caching and session management. The frontend will use React.js or Next.js. All services will be containerized to ensure environment consistency between development and production.

WebSocket infrastructure (Socket.io) must be configured to support concurrent real-time connections for order tracking. This requires appropriate server resources and load testing prior to release. A message queue system (Bull Queue or RabbitMQ) will be implemented to handle asynchronous order processing at scale.

Starting from Release 1, integration with the VNPay payment gateway requires sandbox environment testing and compliance with the payment provider's integration standards before going live. Integration with additional gateways (e.g., MoMo) may be added in subsequent releases following the same approach. All API credentials must be secured using environment variables and must never be committed to source control.

User-facing training materials, including short tutorial videos (no more than 5 minutes each), will be developed for both the web interface and admin dashboard as part of the Release 1 launch package.