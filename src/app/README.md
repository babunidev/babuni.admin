# Application shell

`AdminLayout.tsx` and `Sidebar.tsx` own the current frame and sidebar presentation. `uiStore.ts` owns responsive sidebar state. `navigation.ts` composes navigation from the currently enabled Morkahja workspace.

`src/App.tsx` continues to own the router until workspace routing and permissions are implemented. The layout currently renders `MorkahjaTopBar` explicitly because the Morkahja workspace is the only active one; this is not yet a generic workspace switcher.

Legacy exports under `src/layouts/`, `src/components/`, `src/stores/` and `src/utils/` preserve existing imports until consumers are migrated.
