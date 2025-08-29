// store/mailStore.js
import { create } from 'zustand'

const useMailStore = create((set) => ({
  mail: {
    to: '',
    subject: '',
    body: '',
  },
  setMail: (newMail) => set({ mail: { ...newMail } }),
  resetMail: () => set({ mail: { to: '', subject: '', body: '' } }),
}))

export default useMailStore
