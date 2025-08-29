import { create } from 'zustand'

const callsNotificationStore = create((set, get) => ({
  missedCount: 0,
  appRestart: false, // Переменная для отслеживания перезапуска приложения
  // Состояние фильтров из компонента MissedCall
  missedCallFilters: {
    selectedEmployee: null,
    selectedUnassignedEmployee: false,
    userInfo: null,
  },
  setMissedCount: async (count) => {
    set({ missedCount: count })
  },
  toggleAppRestart: () => set((state) => ({ appRestart: !state.appRestart })), // Переключение состояния
  // Обновление фильтров пропущенных звонков
  setMissedCallFilters: (filters) => {
    set({ missedCallFilters: { ...get().missedCallFilters, ...filters } })
  },
}))

export default callsNotificationStore
