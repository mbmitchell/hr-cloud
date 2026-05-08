# MFN HR Platform Architecture

The MFN HR Platform is an internal employee management and PTO system for **Managed Financial Networks (MFN)**.

This system is **not public SaaS**.  
It is an **internal enterprise HR application** used only by MFN employees.

---

# System Overview

The platform manages:

- Employee records
- PTO and leave requests
- Manager approval workflows
- Company-wide PTO calendar
- HR administrative functions
- Audit logging

Future modules may include:

- onboarding workflows
- offboarding workflows
- employee document management
- document acknowledgement and signatures

---

# Technology Stack

## Frontend

- Next.js 15 (App Router)
- React
- TypeScript
- Tailwind CSS

## Backend

- Node.js
- Prisma ORM
- MySQL

## Authentication

- Auth.js / NextAuth
- Microsoft Entra (Azure AD)

## Infrastructure

Production server:

Ubuntu Linux

Services:

- Nginx reverse proxy
- PM2 process manager
- TLS via Let's Encrypt (DNS-01)
- Fail2Ban
- Nginx rate limiting

---

# Deployment Architecture

Production deployment flow:
