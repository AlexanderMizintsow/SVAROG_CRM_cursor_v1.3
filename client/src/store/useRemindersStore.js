import { create } from 'zustand'

const useRemindersStore = create((set) => ({
  reminders: [],
  setReminders: (newReminders) => set({ reminders: newReminders }),
  addReminder: (reminder) => {
    set((state) => ({
      reminders: [...state.reminders, reminder],
    }))
  },

  // хранение количества рабочих групп
  groupCounts: { fixedCount: 0, rangeCount: 0 },
  setGroupCounts: (newCounts) =>
    set({
      groupCounts: {
        fixedCount: newCounts.fixed, // сохраним значение fixed
        rangeCount: newCounts.range, // сохраним значение range
      },
    }),
}))

export default useRemindersStore
