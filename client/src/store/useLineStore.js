import { create } from "zustand";
import axios from "axios";
import { API_BASE_URL } from "../../config";

const useLineStore = create((set) => ({
  byId: {},
  apply: (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    set((state) => {
      const byId = { ...state.byId };
      list.forEach((row) => {
        if (!row || row.userId == null) return;
        const key = String(row.userId);
        if (!row.state) delete byId[key];
        else byId[key] = row.state;
      });
      return { byId };
    });
  },
  load: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}5004/api/line-status`);
      const byId = {};
      for (const row of response.data || []) {
        if (row?.userId == null || !row.state) continue;
        byId[String(row.userId)] = row.state;
      }
      set({ byId });
    } catch (error) {
      console.error("Ошибка загрузки линий:", error.response?.data || error.message);
    }
  },
}));

export default useLineStore;
