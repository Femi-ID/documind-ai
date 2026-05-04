# Software Project Engineering Guide

> A senior engineer's step-by-step checklist for approaching any software project — from inception to launch.

---

## Phase 1: Discovery & Problem Definition

The goal of this phase is to deeply understand *what* you're building and *why* before thinking about *how*.

### 1.1 — Stakeholder & User Research

- Identify all stakeholders (business owners, end users, ops teams, partner teams).
- Conduct interviews, surveys, or workshops to understand pain points and goals.
- Define the target audience and user personas.
- Clarify the business objectives — what does success look like for the organization?

### 1.2 — Functional Requirements (What the system must DO)

Functional requirements describe the *behaviors* and *features* of the system.

- List all features and capabilities the system must provide.
- Write user stories or use cases for each feature:
  - *"As a [role], I want to [action] so that [outcome]."*
- Define input/output specifications for each feature.
- Map out user flows and journeys end-to-end.
- Specify business rules and validation logic.
- Define roles, permissions, and access control rules.
- Identify integration points (third-party APIs, internal services, data sources).
- Document data requirements — what data is created, read, updated, deleted?
- Define acceptance criteria for each requirement (how do you know it's "done"?).

### 1.3 — Non-Functional Requirements (How the system must PERFORM)

Non-functional requirements define the *quality attributes* and *constraints* of the system.

- **Performance**: Response time targets (e.g., API responses < 200ms at p95), throughput (e.g., 10k requests/sec).
- **Scalability**: Expected user/load growth. Horizontal vs. vertical scaling needs.
- **Availability & Reliability**: Uptime target (e.g., 99.9%), failover strategy, disaster recovery.
- **Security**: Authentication/authorization method, data encryption (at rest, in transit), compliance requirements (GDPR, HIPAA, PCI-DSS, etc.), vulnerability management.
- **Maintainability**: Code quality standards, documentation requirements, modularity goals.
- **Observability**: Logging, monitoring, tracing, alerting requirements.
- **Compatibility**: Supported browsers, devices, OS versions, API versioning strategy.
- **Accessibility**: WCAG compliance level (A, AA, AAA), assistive technology support.
- **Internationalization (i18n)**: Multi-language support, locale handling, RTL support.
- **Data Retention & Privacy**: How long data is stored, deletion policies, anonymization.
- **Cost Constraints**: Budget for infrastructure, third-party services, licensing.

### 1.4 — Scope Definition & Prioritization

- Use MoSCoW (Must / Should / Could / Won't) or similar prioritization to rank requirements.
- Define what is in scope for v1 (MVP) vs. future iterations.
- Get written sign-off from stakeholders on the agreed scope.
- Create a living "out of scope" list to manage expectations.

---

## Phase 2: System Design & Architecture

The goal here is to make high-level technical decisions and document them before writing code.

### 2.1 — High-Level System Design

- Draw the system architecture diagram: major components, services, data stores, external dependencies.
- Choose the architectural pattern (monolith, microservices, serverless, event-driven, modular monolith, etc.) and document *why*.
- Define service boundaries and responsibilities (if applicable).
- Map out communication patterns (sync REST/gRPC, async messaging/events, pub-sub).
- Identify shared infrastructure (API gateway, load balancer, CDN, message broker, cache layer).

### 2.2 — Data Design

- Design the data model (ER diagrams, schema definitions).
- Choose the database(s) and justify the choice (relational, document, graph, time-series, key-value).
- Define data flow: how data enters, moves through, and exits the system.
- Plan for data migration (if replacing an existing system).
- Design the caching strategy (what to cache, invalidation policy, TTLs).
- Plan the backup and recovery strategy.

### 2.3 — API Design

- Define API contracts (endpoints, methods, request/response schemas).
- Use a specification format: OpenAPI/Swagger for REST, Protobuf for gRPC, GraphQL schema, etc.
- Establish API versioning strategy.
- Define error response format and standard error codes.
- Plan rate limiting, throttling, and pagination.
- Design for idempotency where appropriate (especially for payment/mutation operations).

### 2.4 — Infrastructure & Deployment Design

- Choose hosting/cloud provider and justify (AWS, GCP, Azure, self-hosted).
- Design the deployment architecture (containers, orchestration, serverless functions).
- Plan environments: local dev → staging → production (and any others).
- Define the CI/CD pipeline: build → test → deploy → verify.
- Plan the rollback strategy.
- Design for infrastructure-as-code (Terraform, Pulumi, CloudFormation).

### 2.5 — Security Design

- Threat modeling: identify attack surfaces and potential vulnerabilities.
- Design authentication flow (OAuth2, SSO, JWT, session-based).
- Design authorization model (RBAC, ABAC, policy-based).
- Plan secrets management (vault, environment variables, KMS).
- Define network security (VPCs, firewalls, WAF).
- Plan for input validation and sanitization strategy.

### 2.6 — Write the Technical Design Document (TDD / RFC)

Pull all the above into a single document and include:

- Problem statement and context.
- Proposed solution with architecture diagrams.
- Alternatives considered and why they were rejected.
- Data model and API contracts.
- Non-functional requirements and how they're addressed.
- Open questions and known risks.
- Milestones and rough timeline.

**Circulate for review.** Get feedback from peers, architects, and stakeholders before proceeding.

---

## Phase 3: Project Planning & Team Setup

### 3.1 — Work Breakdown & Estimation

- Decompose the project into epics → stories → tasks.
- Estimate effort (story points, t-shirt sizes, or time-based — pick one and be consistent).
- Identify the critical path: which tasks block other tasks?
- Build a realistic timeline with milestones and buffer for unknowns.
- Assign owners to each workstream or component.

### 3.2 — Risk Assessment & Mitigation

- List the top 5–10 risks (technical, organizational, external).
- For each risk, define: likelihood, impact, mitigation strategy, and owner.
- Identify the hardest/most uncertain part and spike it early (build a proof-of-concept).
- Plan contingencies for key risks (e.g., "If vendor API is too slow, we fall back to X").

### 3.3 — Team Communication & Process

- Agree on the development methodology (Scrum, Kanban, Shape Up, or a hybrid).
- Set cadences: standups, sprint planning, retrospectives, demos.
- Define how decisions are documented (ADRs — Architecture Decision Records).
- Agree on PR review expectations (turnaround time, number of approvals).
- Set up communication channels (Slack channels, async updates, escalation paths).

---

## Phase 4: Codebase & Tooling Setup

This phase is about establishing the foundation so that the team can write code consistently and efficiently from day one.

### 4.1 — Repository & Project Structure

- Initialize the repository with a clear, logical folder structure.
- Add a README with: project overview, setup instructions, architecture overview, contribution guidelines.
- Add a CONTRIBUTING.md with coding standards and PR conventions.
- Set up a .gitignore tailored to the tech stack.
- Choose and document the branching strategy (trunk-based, GitFlow, GitHub Flow).

### 4.2 — Code Quality & Consistency

- Set up a linter (ESLint, Pylint, RuboCop, etc.) with agreed-upon rules.
- Set up a formatter (Prettier, Black, gofmt, etc.) and enforce on save / pre-commit.
- Add pre-commit hooks (Husky, pre-commit framework) for linting, formatting, and basic checks.
- Define naming conventions (files, variables, functions, classes, DB columns, API fields).
- Establish code review guidelines (what reviewers should look for, what's blocking vs. non-blocking).

### 4.3 — Testing Strategy

- Define the testing pyramid for the project:
  - **Unit tests**: Individual functions and modules. Fast, isolated.
  - **Integration tests**: Component interactions, database queries, API calls.
  - **End-to-end (E2E) tests**: Critical user flows through the full stack.
  - **Contract tests**: API contracts between services (especially for microservices).
- Set a realistic coverage target (e.g., 80% unit coverage for business logic).
- Set up testing frameworks and write the first example test as a template.
- Configure tests to run in CI on every push/PR.

### 4.4 — CI/CD Pipeline

- Set up the CI pipeline: lint → build → test → security scan → deploy to staging.
- Set up the CD pipeline: promote from staging → production (manual gate or automatic).
- Add notifications for build failures.
- Configure artifact storage (Docker images, build outputs).
- Set up environment-specific configuration management.

### 4.5 — Logging, Monitoring & Observability

- Choose and set up logging infrastructure (structured logging with JSON, centralized log aggregation).
- Instrument the application with metrics (request latency, error rates, throughput).
- Set up distributed tracing (especially for microservices).
- Define alerting rules and on-call responsibilities.
- Create initial dashboards for key health metrics.

### 4.6 — Development Environment

- Create a reproducible local dev setup (Docker Compose, devcontainers, Makefile, scripts).
- Document the "getting started" flow — a new developer should go from zero to running in under 30 minutes.
- Set up seed data or fixtures for local development.
- Ensure parity between local, staging, and production environments as much as possible.

---

## Phase 5: Implementation (Writing Code)

Now you write code — but with discipline.

### 5.1 — Build Incrementally

- Start with the skeleton: project scaffolding, routing, database connection, basic health check endpoint.
- Build vertically (one full feature end-to-end) rather than horizontally (all backend, then all frontend).
- Ship the riskiest or most uncertain features first.
- Keep PRs small and focused — one logical change per PR.

### 5.2 — Follow Coding Principles

- **SOLID** principles for object-oriented design.
- **DRY** (Don't Repeat Yourself) — but don't abstract prematurely.
- **KISS** (Keep It Simple) — the simplest solution that works is usually the best.
- **YAGNI** (You Aren't Gonna Need It) — don't build features "just in case."
- Write self-documenting code: clear naming, small functions, obvious intent.
- Comment the *why*, not the *what*.

### 5.3 — Handle Cross-Cutting Concerns

- Implement consistent error handling and error response formatting.
- Implement authentication and authorization middleware.
- Set up request validation and input sanitization.
- Implement structured logging across all services.
- Handle configuration management (env vars, config files, feature flags).

### 5.4 — Continuous Review & Refactoring

- Conduct code reviews on every PR — no exceptions.
- Refactor as you go; don't let tech debt pile up silently.
- Track tech debt items in the backlog and address them regularly.
- Run retrospectives after each sprint/milestone to improve the process.

---

## Phase 6: Quality Assurance & Validation

### 6.1 — Testing Execution

- Run the full test suite in CI for every merge.
- Perform manual exploratory testing for complex UI flows and edge cases.
- Conduct load/stress testing against non-functional performance targets.
- Run security scanning (SAST, DAST, dependency vulnerability scanning).
- Test failure scenarios: what happens when the database goes down? When a downstream service is slow?

### 6.2 — User Acceptance Testing (UAT)

- Deploy to a staging environment that mirrors production.
- Have stakeholders and/or real users validate against acceptance criteria.
- Document and triage all feedback: fix now, fix later, or won't fix.

---

## Phase 7: Deployment & Launch

### 7.1 — Pre-Launch Checklist

- All critical and high-severity bugs are resolved.
- Performance benchmarks meet non-functional requirements.
- Security audit and penetration testing completed (if required).
- Runbook documented: how to deploy, rollback, restart, scale.
- Monitoring and alerting are active and tested.
- On-call rotation and escalation path are defined.
- Data backup and recovery procedures are verified.
- Legal/compliance sign-off obtained (if applicable).

### 7.2 — Launch Strategy

- Choose a deployment strategy: blue-green, canary, rolling, or feature-flagged rollout.
- Plan the rollout: internal → beta users → percentage rollout → general availability.
- Have a rollback plan ready and tested.
- Communicate the launch to stakeholders, support teams, and users.

### 7.3 — Post-Launch

- Monitor dashboards closely for the first 24–72 hours.
- Watch error rates, latency, and resource utilization.
- Gather early user feedback and triage issues rapidly.
- Conduct a launch retrospective: what went well, what didn't, what to improve next time.

---

## Phase 8: Maintenance & Iteration

### 8.1 — Ongoing Operations

- Maintain dependency updates and security patches.
- Review and act on monitoring alerts and performance trends.
- Rotate and audit secrets and credentials.
- Review and optimize cloud costs periodically.

### 8.2 — Continuous Improvement

- Collect and analyze user feedback and usage analytics.
- Prioritize the next iteration of features based on data.
- Pay down tech debt intentionally — allocate time each cycle.
- Update documentation as the system evolves.
- Revisit architecture decisions as scale and requirements change.

---

## Quick Reference: Phase Summary

| Phase | Focus | Key Output |
|-------|-------|------------|
| 1. Discovery | Understand the problem | Requirements document, scope agreement |
| 2. System Design | Architect the solution | Technical design document, diagrams |
| 3. Planning | Organize the work | Timeline, risk register, team norms |
| 4. Tooling Setup | Prepare the codebase | Repo, CI/CD, linting, testing framework |
| 5. Implementation | Write the code | Working software, reviewed PRs |
| 6. QA & Validation | Verify quality | Test results, UAT sign-off |
| 7. Deployment | Ship to production | Live system, monitoring, runbook |
| 8. Maintenance | Keep it running and evolving | Patches, iterations, retrospectives |

---

*The further upstream you catch a mistake, the cheaper it is to fix. A misunderstanding caught in design review costs an hour. The same misunderstanding caught after two sprints of coding costs weeks of rework. This guide exists to move mistakes left.*
