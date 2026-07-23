# webkelas

To install dependencies:

```bash
bun install
```

## Running the Application

To run the full application, you need to start both the backend API and the frontend UI servers:

### 1. Start the Backend API (Hono)
Runs on `http://localhost:3000` by default.
```bash
bun run dev
```

### 2. Start the Frontend UI (Vite)
Runs on `http://localhost:5173` by default and proxies `/api` requests to the backend.
```bash
bun run dev:ui
```

After starting both, open [http://localhost:5173](http://localhost:5173) in your browser.

## Database Setup (Drizzle ORM)

If you modify the database schema:
* Push schema changes directly to the SQLite database (`sqlite.db`):
  ```bash
  bun run db:push
  ```
* Generate migrations:
  ```bash
  bun run db:generate
  ```

