/// <reference types="vite/client" />

interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

declare module 'virtual:pwa-register' {
  export function registerSW(options?: RegisterSWOptions): () => void;
}
