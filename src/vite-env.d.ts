/// <reference types="vite/client" />

interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

declare module 'virtual:pwa-register' {
  export function registerSW(options?: RegisterSWOptions): () => void;
}

declare module '*.csv?raw' {
  const content: string;
  export default content;
}

declare module '*.csv?url' {
  const url: string;
  export default url;
}
