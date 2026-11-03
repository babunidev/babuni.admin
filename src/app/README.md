# Application shell

`AdminLayout.tsx` and `Sidebar.tsx` own the shared frame. `uiStore.ts` owns responsive sidebar state. `navigation.ts` declares the available frontend workspaces and resolves the current one from the URL. `BabuniDevTopBar.tsx` displays a static portfolio header; the existing Morkahja status bar remains project-specific.

`src/App.tsx` retains the original Morkahja routes and adds `/babuni-dev`. Workspace switching uses navigation, not a persisted global flag, so bookmarks and browser history remain consistent. This is **not** a permission system.

Legacy exports remain in older locations to preserve compatibility while imports are migrated.
