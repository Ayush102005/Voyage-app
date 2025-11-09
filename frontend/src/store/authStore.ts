import { create } from 'zustand'

interface User {
  uid: string
  email: string | null
  displayName: string | null
}

interface UserPreferences {
  travelStyle?: string
  interests?: string[]
  budgetPreference?: string
  profileComplete?: boolean
}

interface AuthState {
  user: User | null
  loading: boolean
  preferences: UserPreferences | null
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setPreferences: (preferences: UserPreferences | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  preferences: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setPreferences: (preferences) => set({ preferences }),
}))
