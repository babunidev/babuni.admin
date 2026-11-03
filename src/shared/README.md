# Shared resources

`components/` contains generic `PageHeader`, `Table`, `StatusBadge` and `ConnectionBanner` controls. `utils/format.ts` contains formatting helpers. These pieces have no direct dependency on Morkahja data services.

The temporary root component and formatting re-exports have been removed; consumers use these modules directly. Do not move game-specific controls into this directory simply to make imports shorter.
