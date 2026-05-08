# MFN HR Platform – Development Agent Instructions

This repository contains the **MFN HR Platform**, an internal employee management and PTO system for **Managed Financial Networks (MFN)**.

This is **not a public SaaS product**.  
It is an **internal enterprise HR application** used only by MFN employees.

AI agents (Codex, ChatGPT, etc.) must follow the rules in this file when modifying code.

---

# Core System Architecture

Frontend / Application
- Next.js 15 (App Router)
- React
- TypeScript
- Tailwind CSS

Backend
- Node.js
- Prisma ORM
- MySQL

Authentication
- Auth.js / NextAuth
- Microsoft Entra (Azure AD) SSO

Infrastructure
- Ubuntu Linux
- Nginx reverse proxy
- PM2 process manager
- TLS via Let's Encrypt (DNS-01)
- Fail2Ban
- Nginx rate limiting

Deployment flow:

Developer → GitHub → Server auto-pull → Build → PM2 restart

Server path:

/home/mfn-hr/mfn-hr-app

App runtime:

localhost:3000 behind Nginx

---

# Domain Rules

Only allow users from:

@mfncuso.com

Never reference or use:

managedfinancialnetworks.com

This rule must apply to:

- authentication logic
- email validation
- configuration
- examples
- seed data

---

# Authentication Model

Authentication uses Microsoft Entra SSO.

Login flow:

1. User authenticates via Entra
2. Email must match an existing Employee record
3. If match exists:
   - entraOid stored
   - entraTid stored
4. Session created

Important security rule:

Users **must already exist in the Employee table** before login.

The system does **not auto-create employees** during login.

---

# Authorization Model

The application uses **role-based access control**.

Typical roles include:

- employee
- manager
- admin

Guidelines:

Managers can view employees that report to them.

Admins can manage the system.

Employees can view only their own records unless elevated.

Authorization must be **validated server-side**.

Never rely solely on client-side checks.

---

# Existing Core Modules

## Employee Management

- employee directory
- manager relationships
- employee profiles

## PTO System

- PTO request submission
- manager approval workflow
- PTO ledger
- accrual logic
- COMP time tracking
- bereavement tracking

## Calendar

- company-wide PTO calendar
- staffing conflict detection

## Admin

- PTO adjustments
- audit logging
- role-based authorization

---

# Planned Future Modules

These modules may be implemented later.

Agents should **not scaffold these unless explicitly instructed**.

Employee Lifecycle
- onboarding workflows
- offboarding workflows

Documents
- employee document storage
- document templates
- document acknowledgements
- digital signatures

HR Operations
- performance reviews
- compliance reporting
- policy acknowledgements

---

# Development Rules

AI agents must follow these rules:

1. Work in **small scoped changes**
2. Do **not refactor unrelated code**
3. Preserve existing PTO functionality
4. Follow existing patterns in the repository
5. Avoid large architectural rewrites
6. Maintain strong TypeScript typing
7. Preserve server-side authorization
8. Avoid introducing new dependencies unless necessary

Before coding:

- inspect relevant files
- explain a short plan
- identify risks

After coding:

- list files changed
- list commands needed to run
- describe manual verification steps

---

# Database Rules

The database uses Prisma with MySQL.

Guidelines:

- Do not modify unrelated models
- Use migrations for schema changes
- Preserve compatibility with existing Employee data
- Avoid destructive schema changes
- Maintain createdAt / updatedAt patterns where present

---

# File Storage Rules

Employee documents should **not be stored inside the application directory**.

Preferred architecture:

- object storage OR
- secure server storage outside the web root

Database should store only metadata.

---

# Security Requirements

The system handles sensitive employee data.

Agents must preserve or improve:

- server-side authorization
- input validation
- SQL injection protection (Prisma)
- role validation
- audit logging for sensitive actions

Never expose:

- employee documents publicly
- internal APIs without authorization
- database credentials

---

# UI Guidelines

The UI follows a consistent structure.

Layout system:

components/layout/app-shell.tsx

Navigation:

components/layout/sidebar-client.tsx  
components/layout/sidebar-nav.ts

Design goals:

- simple internal enterprise UI
- mobile responsive
- clean navigation

Agents should not redesign the UI without instruction.

---

# Deployment Commands

Typical deployment sequence:
