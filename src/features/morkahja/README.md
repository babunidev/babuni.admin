# Morkahja workspace

The existing Dashboard, Players and Content pages and their domain components, services, types and utilities live here. `navigation.ts` defines current project links, and `components/MorkahjaTopBar.tsx` owns game-server and connection status in the application header.

The shared shell currently renders that status bar and project navigation explicitly while Morkahja is the only active workspace. Existing route URLs are preserved. Compatibility exports at historical paths remain until tested direct-import migration. No production backend security changes were made.
