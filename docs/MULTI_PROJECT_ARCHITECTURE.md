# Multi-project administration — first migration

**Creative direction.** Babuni Admin is to become a common administration application for Morkahja, Babuni Dev and future projects, rather than remain exclusively a Morkahja tool. The existing Morkahja functions must be preserved.

**AI implementation.** Relocated the three Morkahja page components to `src/features/morkahja/pages/`, updated their relative imports and the central router, and reserved `src/features/babuni-dev/`, `src/app/` and `src/shared/`. The existing route URLs, service adapters, Vite middleware, credentials and data files were not changed. This is the first structural migration, not the completion of the larger feature-boundary refactor.

**Unresolved security boundaries.** Vite `VITE_` secrets and local content/PostgreSQL write endpoints must not be treated as safe remote administrative APIs. Production operation needs independent authentication, authorization, validation, audit trails and separation between project permissions before exposing any privileged service.

**Verification.** GitHub commit and import-path review only. No npm build/lint, database operation or browser regression test was run here. Testing must precede deployment.
