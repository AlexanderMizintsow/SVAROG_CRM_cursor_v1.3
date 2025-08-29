import { create } from 'zustand'

const useVersionInfo = create((set) => ({
  versions: [], // Состояние для хранения версий
  setVersions: (newVersions) => set({ versions: newVersions }), // Функция для обновления версий
}))

export default useVersionInfo
