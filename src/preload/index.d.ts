import type { DesignApi } from '@shared/ipc'

declare global {
  interface Window {
    api: DesignApi
  }
}

export {}