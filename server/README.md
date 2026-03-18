# King G POS – Node backend

Express API for products, sales, and audit. Data is stored in JSON files under `data/`.

## Run

From project root:

```bash
npm run server
```

Or from this folder:

```bash
npm start
```

Server listens on **http://localhost:3001**. The Vite dev server proxies `/api` to this port.

## Endpoints

- `GET /api/health` – health check
- `GET /api/products` – all products with stock
- `GET /api/products/barcode/:barcode` – product by barcode (404 if not found)
- `GET /api/products/search?q=&limit=20` – search by name/barcode/category
- `GET /api/categories` – list of categories
- `POST /api/sales` – create sale (body: `{ cashierId, items, total, payments }`)
- `POST /api/audit` – append audit entry

## Data files

- `data/products.json` – product catalog
- `data/inventory.json` – stock per productId
- `data/sales.json` – completed sales (appended)
- `data/audit.json` – audit log (appended)

Edit `products.json` and `inventory.json` to change catalog and stock. Sales and audit are written by the API.
