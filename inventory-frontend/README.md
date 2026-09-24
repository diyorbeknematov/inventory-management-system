# Inventory Management System

A multi-merchant inventory management system built with **React, TypeScript, and Vite**.

The system is designed to manage products, product variations, warehouses, shops, stock levels, users, and stock movements across multiple merchants.

## Features

### Authentication

* User login
* Protected routes
* Role-based access control
* Automatic redirect to the login page after logout
* Merchant-scoped data access

### User Roles

The system supports the following roles:

* **Admin** — manages merchants and users
* **Merchant** — manages their own inventory and users
* **Shop Manager** — manages a specific shop
* **Warehouse Manager** — manages a specific warehouse

### Products

* Create and manage products
* Product categories
* Product variations
* SKU
* Size and color
* Product images
* Stock quantities

### Categories

* Create categories
* Manage categories
* Support for subcategories

### Shops

* Create and manage shops
* View shop information
* View shop inventory
* Manage stock associated with a shop

### Warehouses

* Create and manage warehouses
* View warehouse information
* Manage warehouse stock

### Stock Movements

The system supports four movement types:

| Type       | Description                     |
| ---------- | ------------------------------- |
| `SALE`     | Shop → Customer                 |
| `RECEIPT`  | External source → Warehouse     |
| `RETURN`   | Shop → Warehouse                |
| `TRANSFER` | Warehouse/Shop → Warehouse/Shop |

Movement statuses:

| Status     | Description                                             |
| ---------- | ------------------------------------------------------- |
| `DRAFT`    | Movement is being prepared                              |
| `SENT`     | Movement has been submitted and stock processing starts |
| `ACCEPTED` | Movement was processed successfully                     |
| `REJECTED` | Movement processing failed                              |

### Stock Movement Workflow

A movement is created as a `DRAFT`.

While the movement is in `DRAFT` status, its source, destination, and products can be edited.

After the movement is sent:

```text
DRAFT
  ↓
SENT
  ↓
ACCEPTED
```

If stock processing fails:

```text
DRAFT
  ↓
SENT
  ↓
REJECTED
```

Once a movement leaves the `DRAFT` state, it cannot be edited.

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* React Hooks
* Lucide React

### Backend

* Go
* Ucode
* PostgreSQL

### API

The frontend communicates with the backend through API requests.

The application uses authenticated requests with a Bearer access token.

## Project Structure

```text
src/
├── api/
│   ├── ...
│
├── components/
│   ├── movements/
│   ├── products/
│   ├── shops/
│   ├── users/
│   └── ...
│
├── pages/
│   ├── Login.tsx
│   ├── Products.tsx
│   ├── Categories.tsx
│   ├── Shops.tsx
│   ├── Warehouses.tsx
│   ├── Movements.tsx
│   └── Users.tsx
│
├── types/
│   └── ...
│
├── App.tsx
└── main.tsx
```

## Getting Started

### Requirements

Make sure you have installed:

* Node.js
* npm

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd inventory-frontend
```

Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at the local development URL shown by Vite.

### Production Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Code Quality

This project uses **Oxlint** for linting.

For a production application, type-aware linting can be enabled with `oxlint-tsgolint`.

Example configuration:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": [
      "warn",
      {
        "allowConstantExport": true
      }
    ]
  }
}
```

Run the linter with:

```bash
npm run lint
```

Do not commit sensitive credentials or access tokens to the repository.

## Development Notes

The frontend is designed around merchant-scoped inventory management.

Users only interact with the shops, warehouses, products, and movements that they are authorized to manage according to their role and merchant scope.

Stock movement operations are validated by the backend before stock quantities are changed.



