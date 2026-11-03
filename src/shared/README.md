# Shared resources

`components/` contains generic `PageHeader`, `Table`, `StatusBadge` and `ConnectionBanner` controls. `utils/format.ts` contains formatting helpers. These pieces have no direct dependency on Morkahja data services.

The old component and utility paths still provide compatibility exports. Do not move game-specific controls into this directory simply to make imports shorter.
