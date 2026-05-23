# Morkahja Admin

Dark, minimal admin dashboard for the Morkahja realm — React, TypeScript, and Vite.

## Stack

- React + TypeScript (Vite)
- React Router
- TanStack Query (data fetching)
- Zustand (UI state)
- Tailwind CSS v4

## Development

```bash
npm install
npm run dev
```

## Structure

```
src/
  components/   # Shared UI (Table, layout chrome)
  layouts/      # Admin shell
  pages/        # Route views
  services/     # API layer (mock data for now)
  stores/       # Client UI state
  types/        # Shared TypeScript types
  utils/        # Helpers
```

Mock data only — connect `src/services/adminApi.ts` to your backend when ready.
