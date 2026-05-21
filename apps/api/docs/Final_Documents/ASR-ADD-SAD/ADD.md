# **ATTRIBUTE-DRIVEN** **DESIGN DOCUMENT**

### Flight Ticket Booking System

_Prepared by_


Ha Phu Thinh
Nguyen Cong Thanh

Vo Tan Hoang


##### **Table of content**

**1. Design Constraints.....................................................................................................................**

**2. Quality Attribute Requirements...............................................................................................**

2.1. Security.......................................................................................................................................................

2.1.1. Authentication and Authorization.............................................................................................

2.1.2. Data Protection................................................................................................................................

2.1.3. Payment Security............................................................................................................................

2.2. Performance..............................................................................................................................................

2.2.1. Fast Response Times......................................................................................................................

2.2.2. Advanced Search Efficiency.........................................................................................................

2.2.3. Scalability for Concurrent Users................................................................................................

2.3. Usability......................................................................................................................................................

2.3.1. Smooth User Experience...............................................................................................................

2.3.2. Easy-to-Use Interface.....................................................................................................................

2.4. Interoperability........................................................................................................................................

2.4.1. Third-Party System Integration..................................................................................................

2.4.2. Internal Microservice Communication....................................................................................

2.5. Modifiability..............................................................................................................................................

2.5.1. Supporting Business Requirement Changes...........................................................................

2.5.2. Zero-Downtime Updates...............................................................................................................

2.6. Availability.................................................................................................................................................

2.6.1. Fault Tolerance and System Recovery......................................................................................

2.6.2. Automated Payment Response Handling.................................................................................

**3. Architectural Representation...................................................................................................**

3.1. Logical View..............................................................................................................................................

3.2. Implementation View.............................................................................................................................

3.3. Deployment View....................................................................................................................................

3.4. Data View...................................................................................................................................................


## 1. Design Constraints

ー **Scalability** : The system must support thousands of concurrent users

during peak times, such as holidays or promotional periods.

ー **Performance** : 95% of user requests should be handled within 3

seconds, and 100% within 5 seconds.

ー **Security** : The system must encrypt all sensitive data, use strong

password hashing (bcrypt with salt), and enforce access control

using JWT and RBAC.

ー **Availability** : Target system uptime of ≥ 99.9%. Must recover from

service failures with MTTR < 30 minutes.

ー **Modifiability** : Architecture must support independent microservice

updates and allow for fast business logic modifications.

ー **Interoperability** : The system must securely integrate with third
party services (e.g., VNPay, MoMo, airline APIs).

ー **Usability** : Interfaces should be intuitive and responsive, supporting

responsive design across desktop and mobile.

## 2. Quality Attribute Requirements

#### 2.1. Security

##### 2.1.1. Authentication and Authorization






|Element|Statement|
|---|---|
|Stimulus|Users attempt to log in, sign up, reset passwords, or access<br>restricted features.|
|Stimulus<br>source|Customers, Airline Staf, Admins.|
|Environmen<br>t|Normal operation via Web Frontend (Next.js), future mobile<br>apps, or direct API access.|


|Artifact|User Account Services, API Gateway, Role-based Access Control<br>modules.|
|---|---|
|Response|Password hashing using bcrypt + salt.JWT-based stateless<br>authentication.RBAC enforcement per service using Security<br>Matrix.Sign-up via email/phone with OTP.Captcha and<br>Cloudfare Bot detection to prevent DDOS.Admin alerts on<br>abnormal trafc.|
|Response<br>measure|100% passwords stored hashed with salt.JWT verifcation within<br>200ms.OTP delivered within 30s.>= 99.9% unauthorized access<br>blocked/logged.Avg login/signup time < 1s.|


##### 2.1.2. Data Protection












|Element|Statement|
|---|---|
|Stimulus|System stores, processes, or transmits sensitive<br>personal/payment data.|
|Stimulus<br>source|Users registering, booking, or making payments.|
|Environmen<br>t|Data lifecycle: entry, storage (PostgreSQL, MongoDB), network<br>transmission.|
|Artifact|Databases, storage layers, internal/external network.|
|Response|All data in transit encrypted via HTTPS/TLS.Sensitive data<br>encrypted at rest in DBs.Access to data stores tightly<br>restricted.GDPR principles enforced.Logs protected and<br>anonymized if needed.Server access via SSH keys and role-based<br>authorization.|
|Response<br>measure|100% communications encrypted via HTTPS/TLS.100% sensitive<br>data encrypted at rest.GDPR compliance checks passed.Potential<br>leak detection & response time < 4 hours.|


##### 2.1.3. Payment Security












|Element|Statement|
|---|---|
|Stimulus|Users make payments or the system receives payment<br>webhooks.|
|Stimulus<br>source|Users, Payment Gateways (VNPay, MoMo).|
|Environmen<br>t|During the online payment process on web/mobile.|
|Artifact|Payment Integration Module, Order Service, Transaction DB.|
|Response|No full card info stored.Secure integration via HTTPS +<br>authentication.Webhook signatures verifed.Payment processing<br>is idempotent.|
|Response<br>measure|0% full card data stored.100% encrypted, authenticated<br>communication.100% webhook validation before processing.<=<br>0.1% transaction failure due to system-side security errors.|


#### 2.2. Performance

##### 2.2.1. Fast Response Times








|Element|Statement|
|---|---|
|Stimulus|Users send requests such as search fights, load pages, book<br>tickets.|
|Stimulus<br>source|Customers, Airline Staf, Admins.|
|Environmen<br>t|Normal and peak operation times.|
|Artifact|Application servers (Node.js, Spring Boot), databases|


|Col1|(PostgreSQL, MongoDB), cache (Redis), API Gateway.|
|---|---|
|Response|Process all user requests within 3-5 seconds.Optimize<br>performance using Redis cache for frequently accessed<br>data.Efcient DB indexing and query planning.Asynchronous<br>processing for non-urgent tasks.|
|Response<br>measure|>= 95% requests processed within 3 seconds.100% processed<br>within 5 seconds.Main pages load in under 2 seconds.Alert<br>triggered when avg response time exceeds threshold.|


##### 2.2.2. Advanced Search Efficiency












|Element|Statement|
|---|---|
|Stimulus|Users perform searches using flters such as location, airline,<br>price.|
|Stimulus<br>source|Customers, Support Staf.|
|Environmen<br>t|Concurrent usage with multiple searches.|
|Artifact|Search service, PostgreSQL/Elasticsearch, frontend UI.|
|Response|Use Elasticsearch for full-text search, autocomplete, typo<br>tolerance.Flight and shuttle data indexed for fast access.Search<br>APIs support fltering and sorting by criteria.Paginated results<br>improve UX and performance.|
|Response<br>measure|>= 95% search results delivered in < 2 seconds.|


##### 2.2.3. Scalability for Concurrent Users


|Element|Statement|
|---|---|
|Stimulus|High number of concurrent users accessing or performing<br>transactions.|
|Stimulus<br>source|Multiple customers, peak events.|
|Environmen<br>t|Peak trafc, large promotions.|
|Artifact|API Gateway, microservices (Node.js, Spring Boot), DBs,<br>infrastructure.|
|Response|Horizontally scalable microservices with auto-scaling.Load<br>balancers for trafc distribution.Read replicas for PostgreSQL,<br>MongoDB sharding if needed.Redis for caching and message<br>queuing.|
|Response<br>measure|Avg response time < 3 seconds for X concurrent users (e.g.,<br>1000).<= 0.5% error rate due to overload.Auto-scaling in < 5<br>minutes.|


#### 2.3. Usability

##### 2.3.1. Smooth User Experience








|Element|Statement|
|---|---|
|Stimulus|Users perform booking-related actions: search fights, select<br>seats, add baggage, complete payment.|
|Stimulus<br>source|Customers, Support Staf.|
|Environmen<br>t|During normal use across various devices and browsers.|
|Artifact|Frontend UI (Next.js, Tailwind CSS, Material UI), booking|


|Col1|workflows, backend APIs.|
|---|---|
|Response|Intuitive UI using modern components.Minimized steps in<br>booking process with clear guidance.Client-side validation and<br>error feedback.Responsive design across devices.|
|Response<br>measure|>= 95% users complete booking on frst attempt.Booking fow<br>time < 5 minutes for experienced users.>= 80% form input errors<br>caught on client-side.User satisfaction rating >= 8/10.|


##### 2.3.2. Easy-to-Use Interface












|Element|Statement|
|---|---|
|Stimulus|Users interact with menus, buttons, forms, seat maps, calendars.|
|Stimulus<br>source|Customers, Support Staf, Airline Staf, Admins.|
|Environmen<br>t|On desktop, tablet, and mobile devices.|
|Artifact|UI components built with Next.js, Tailwind CSS, Material UI.|
|Response|Consistent design across pages.Key functions are prominent and<br>accessible.Plain language, minimal jargon.Visual cues and<br>instant feedback for user actions.|
|Response<br>measure|Avg time to fnd/understand a function < 1 minute.<= 5% users<br>need support for basic tasks.Click steps for common tasks<br>optimized.>= 90% users complete usability tests successfully.|


#### 2.4. Interoperability

##### 2.4.1. Third-Party System Integration


|Element|Statement|
|---|---|
|Stimulus|The system sends requests (e.g., for payment processing, fight<br>info retrieval) or receives data (e.g., payment status, shuttle<br>schedule) from external systems.|
|Stimulus<br>source|Payment gateways, shuttle service APIs, airline APIs, currency<br>exchange APIs.|
|Environmen<br>t|During normal operation when external service interaction is<br>required.|
|Artifact|API integration modules (Node.js, Spring Boot), webhook<br>handlers, connection management services.|
|Response|Use REST APIs or standard protocols (e.g., SOAP if required) to<br>communicate with third parties.All communication is encrypted<br>(HTTPS).Secure authentication for outbound API calls (API keys,<br>OAuth tokens).Robust error-handling with retry logic, timeouts,<br>and backof strategies.Detailed logging for monitoring and<br>debugging using Logstash and Kibana.Webhook handling with<br>integrity and source validation.|
|Response<br>measure|>= 99.5% successful integration requests (excluding partner-side<br>issues).Avg response time for external interactions < 1 second<br>(excluding partner latency).Integration failure rate <=<br>0.5%.System recovers from failed external service within 5<br>minutes.|


##### 2.4.2. Internal Microservice Communication






|Element|Statement|
|---|---|
|Stimulus|One microservice requests data or triggers actions from another<br>(e.g., booking service calling notifcation service).|
|Stimulus<br>source|Internal microservices (Node.js, Spring Boot).|


|Environmen<br>t|Normal operation when services interact to complete workflows.|
|---|---|
|Artifact|API Gateway, inter-service APIs, service discovery mechanisms,<br>messaging infrastructure (e.g., Redis Pub/Sub).|
|Response|Synchronous REST APIs for immediate-response requests using<br>JSON format.Asynchronous messaging via Redis Pub/Sub for<br>background or decoupled tasks.API Gateway for client-facing<br>requests with shared responsibilities like authentication and<br>rate limiting.Use patterns like circuit breaker, retry, and timeout<br>to enhance fault tolerance.Secure inter-service communication<br>via mTLS or token-based authentication.|
|Response<br>measure|Avg latency for synchronous service calls < 50ms (excluding<br>processing time).Inter-service error rate <= 0.1%.Redis Pub/Sub<br>event handling avg time < 500ms.100% sensitive microservice<br>communication is secured.|


#### 2.5. Modifiability

##### 2.5.1. Supporting Business Requirement Changes








|Element|Statement|
|---|---|
|Stimulus|A change in business logic (e.g., refund policy, new ticket types),<br>new feature requests, or updates to existing workfows.|
|Stimulus<br>source|Business stakeholders, product development team.|
|Environmen<br>t|During development or maintenance phases.|
|Artifact|Business logic microservices (Node.js, Spring Boot), databases<br>(PostgreSQL, MongoDB), frontend (Next.js).|
|Response|Microservice architecture allows localized changes to specifc|


|Col1|services.High cohesion and loose coupling in service<br>design.Flexible design patterns (e.g., Strategy, Rule Engine) for<br>business logic variability.Centralized confgi management for<br>adjustable business parameters.Well-documented APIs and<br>comprehensive automated testing to ensure minimal regression.|
|---|---|
|Response<br>measure|Avg time to implement minor business rule change < 1<br>week.Number of services afected by common changes<br> <br>≤<br>2.Regression rate after updates<br> 1%<br>≤|


##### 2.5.2. Zero-Downtime Updates












|Element|Statement|
|---|---|
|Stimulus|A new version of a microservice, confguration update, or<br>security patch needs to be deployed.|
|Stimulus<br>source|DevOps or development team.|
|Environmen<br>t|Production environment with active users.|
|Artifact|Microservices (Node.js, Spring Boot), deployment infrastructure,<br>API Gateway.|
|Response|Apply zero-downtime deployment strategies (e.g., blue-green<br>deployment).Use automated deployment tools and CI/CD<br>pipelines.Monitor health checks and rollback on failure.|
|Response<br>measure|>= 99% of updates cause no user-visible disruption.Rolling<br>update of a service completes in < 30 minutes.Rollback to<br>previous version completes within 10 minutes if needed.|


#### 2.6. Availability

##### 2.6.1. Fault Tolerance and System Recovery












|Element|Statement|
|---|---|
|Stimulus|One or more system components (e.g., microservice, DB instance,<br>server) fails or becomes unavailable.|
|Stimulus<br>source|Hardware failure, software bug, network issue, third-party<br>service outage.|
|Environmen<br>t|During system runtime.|
|Artifact|Core infrastructure: microservices (Node.js, Spring Boot),<br>databases (PostgreSQL, MongoDB, Redis), API Gateway.|
|Response|Microservices architecture isolates failures.Replicas and failover<br>mechanisms for critical services and databases.Load balancers<br>redirect trafc from failed instances.Fault tolerance patterns<br>(e.g., circuit breaker) prevent error propagation.Scheduled<br>backups and disaster recovery plans in place.Monitoring and<br>alerting systems (Prometheus, Grafana).|
|Response<br>measure|System uptime<br> 99.9%.MTTR (Mean Time to Recovery) < 30<br>≥<br>minutes.RPO (Recovery Point Objective) < 1 hour, RTO (Recovery<br>Time Objective) < 4 hours.System can handle failure of at least<br>one instance per critical microservice without service<br>disruption.|


##### 2.6.2. Automated Payment Response Handling


|Element|Statement|
|---|---|
|Stimulus|The system receives a webhook from a payment gateway about a<br>transaction result (success, failure, pending).|


|Stimulus<br>source|Payment gateways (e.g., VNPay, MoMo).|
|---|---|
|Environmen<br>t|After the user completes or cancels a payment on the payment<br>gateway interface.|
|Artifact|Webhook processing service, order management service,<br>notifcation service, PostgreSQL database.|
|Response|Automatically process webhook notifcations reliably.On success:<br>update order status, trigger ticket issuance, send confrmation<br>via email/SMS.On failure: update order, notify user with retry<br>instructions.Ensure idempotency to avoid duplicate<br>processing.Detailed logging for audit and debugging.|
|Response<br>measure|>= 99.9% of payment responses processed correctly within 1<br>minute.>= 98% of users notifed within 2 minutes post-<br>transaction.Webhook-related order status error rate<br> 0.01%.<br>≤|


## 3. Architectural Representation

To describe the architecture of the Flight Booking System, the following views are

presented:

#### 3.1. Logical View


This view presents the system's modular decomposition into functional

components and subsystems.


Subsystems:


ー User Service: Handles authentication, registration, account management.

ー Flight Service: Manages flight schedules, availability, and airline data.

ー Booking Service: Manages reservation logic, seat selection, baggage

options.

ー Payment Service: Interfaces with third-party gateways (e.g., VNPay, MoMo),

processes transactions.


ー Notification Service: Sends email/SMS for confirmations and alerts.

ー Admin Service: Enables airline staff and admins to manage flights,

bookings, and users.

ー Gateway API: Serves as the entry point, performs routing, rate limiting, and

JWT validation.

#### 3.2. Implementation View


This view outlines the organization of code and deployment artifacts.


Structure:


ー Each subsystem is implemented as an independent microservice (Node.js

or Spring Boot).

ー Shared libraries for logging, validation, and security are maintained in a

common module.

ー CI/CD pipelines are configured for each service separately.


Technologies:


ー Backend: Node.js, Spring Boot

ー Frontend: Next.js, Tailwind CSS

ー Message Broker: Redis Pub/Sub for async messaging

ー CI/CD: GitHub Actions, Docker, Kubernetes

#### 3.3. Deployment View


Describes the physical deployment of system components.


Environment:


ー Hosted on a cloud provider (e.g., AWS, GCP, or Azure)

ー Kubernetes Cluster manages microservice containers


ー Load Balancer distributes incoming traffic

ー Database Nodes: PostgreSQL primary + replicas, MongoDB

ー Redis Cluster: For caching and Pub/Sub


Deployment Example:


ー Region: Singapore (Low latency for local users)

ー Services are containerized using Docker and orchestrated via Kubernetes

ー Monitoring via Prometheus + Grafana

#### 3.4. Data View


Focuses on data models and storage strategy.


Primary Storage:


ー PostgreSQL: Relational storage for users, bookings, transactions

ー MongoDB: For flexible flight data and logs

ー Redis: Short-lived data (e.g., OTP, session tokens, pending verification)


Security Measures:


ー All sensitive data encrypted at rest

ー HTTPS enforced in all client-server and inter-service communication

ー Role-based access for each database cluster node


