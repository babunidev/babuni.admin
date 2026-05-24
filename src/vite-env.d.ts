/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PREFIX?: string
  readonly VITE_USE_MOCK_DATA?: string
  readonly VITE_API_TOKEN?: string
  readonly VITE_API_CREDENTIALS?: string
  readonly VITE_GAME_DATA_URL?: string
  readonly VITE_UI_URL?: string
  readonly VITE_USE_LOCAL_CONTENT?: string
  readonly VITE_MORKAHJA_PUBLIC?: string
  readonly VITE_DATABASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
