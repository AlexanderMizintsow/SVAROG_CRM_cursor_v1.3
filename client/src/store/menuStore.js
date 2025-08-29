import { create } from 'zustand'

const useMenuOpen = create((set) => ({
  menu: false,
  toggleMenu: () => set((state) => ({ menu: !state.menu })), // Исправлено на прямое переключение
}))

export default useMenuOpen
