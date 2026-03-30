# 👑 King G System
**Enterprise POS & Operations Management Platform**

King G is a full-stack POS and inventory management system designed for real-world operations.  
It supports sales processing, stock control, and role-based workflows for staff and management.

🔗 Live System: https://king-g-system.vercel.app

---

## 🚀 Features

### 🛒 POS (Point of Sale)
- Product search and selection
- Dynamic cart management
- Real-time pricing calculations
- Transaction processing
- Duplicate submission protection

### 📦 Inventory Management
- Stock receiving (draft → verify → confirm)
- Expected vs received quantity tracking
- Inventory updates with audit traceability
- Blind transfer / stock movement support

### 👥 Role-Based Access Control (RBAC)
- Owner, Senior Manager, Manager, Cashier, Operator roles
- Protected routes and permission-based actions
- Secure session handling

### 📊 Operations & Workflow
- Task/operation tracking (Operator view)
- Incident visibility and follow-up (Owner)
- Dashboard metrics and reporting

### 🔐 Security & Integrity
- JWT-based authentication
- Supabase-backed data layer
- Audit-ready system design
- CI pipeline validation

---

## 🏗️ Architecture

This repository is a **full-stack monorepo**:

| Layer      | Stack |
|------------|------|
| Frontend   | Vite + React + TypeScript |
| Backend    | Express (REST API) |
| Database   | Supabase |
| Auth       | JWT |
| CI/CD      | GitHub Actions |
| Deployment | Vercel |

---

## ⚙️ Prerequisites

- Node.js **20.x**
- npm
- Docker (optional)

---

## 🧑‍💻 Local Development

### Install dependencies
```bash
npm install
