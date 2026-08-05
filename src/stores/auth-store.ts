import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserInfo {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      hasPermission: (perm: string) => {
        const state = get();
        return state.user?.permissions?.includes(perm) ?? false;
      },
    }),
    { name: 'ad-portal-auth' },
  ),
);
