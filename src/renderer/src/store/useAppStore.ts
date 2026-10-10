import { create } from 'zustand'
import type { AppSettings, BrandProfile } from '@shared/schemas'
import type { AppInfoDTO, SecretStatusDTO } from '@shared/ipc'
import { call } from '../lib/api'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  message: string
}

interface AppState {
  settings: AppSettings | null
  profiles: BrandProfile[]
  info: AppInfoDTO | null
  secrets: SecretStatusDTO | null
  bootstrapped: boolean
  toasts: Toast[]
  bootstrap: () => Promise<void>
  refreshSettings: () => Promise<void>
  refreshProfiles: () => Promise<void>
  refreshSecrets: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  toast: (kind: Toast['kind'], message: string) => void
  dismissToast: (id: string) => void
}

let toastSeq = 0

export const useAppStore = create<AppState>((set, get) => ({
  settings: null,
  profiles: [],
  info: null,
  secrets: null,
  bootstrapped: false,
  toasts: [],

  bootstrap: async () => {
    if (get().bootstrapped) return
    const [info, settings, profiles, secrets] = await Promise.all([
      call(window.api.app.info()),
      call(window.api.settings.get()),
      call(window.api.profiles.list()),
      call(window.api.secrets.status())
    ])
    set({ info, settings, profiles, secrets, bootstrapped: true })
  },

  refreshSettings: async () => {
    const settings = await call(window.api.settings.get())
    set({ settings })
  },

  refreshProfiles: async () => {
    const profiles = await call(window.api.profiles.list())
    set({ profiles })
  },

  refreshSecrets: async () => {
    const secrets = await call(window.api.secrets.status())
    set({ secrets })
  },

  updateSettings: async (patch) => {
    const settings = await call(window.api.settings.update(patch))
    set({ settings })
  },

  toast: (kind, message) => {
    const id = `t-${Date.now()}-${toastSeq++}`
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => get().dismissToast(id), 5200)
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** Démarre le chargement initial (info, paramètres, profils, état des secrets). */
export async function bootstrapStore(): Promise<void> {
  await useAppStore.getState().bootstrap()
}