import { create } from 'zustand'

const useAsteriskStore = create((set) => ({
  missedCalls: [],
  setMissedCalls: (calls) => set({ missedCalls: calls }),
}))

export default useAsteriskStore
