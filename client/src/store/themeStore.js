import { create } from 'zustand'

const useThemeStore = create((set) => ({
  theme: localStorage.getItem('theme') || 'light', // Чтение темы из localStorage
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', newTheme) // Сохранение новой темы в localStorage
      return { theme: newTheme }
    }),
}))

export default useThemeStore
