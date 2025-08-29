import { create } from 'zustand'

// Создаем хранилище состояния с помощью Zustand
const useUserStore = create((set) => ({
  user: null, // Состояние для хранения данных пользователя
  users: [], // Состояние для хранения списка всех пользователей
  avatar: '/avatar.png',
  // Метод для установки данных пользователя
  setUser: (userData) => set(() => ({ user: userData })), //.userId

  // Метод для очистки данных пользователя
  clearUser: () => set(() => ({ user: null })),
  // Метод для обновления аватара
  setAvatar: (avatarUrl) => set(() => ({ avatar: avatarUrl })),

  // Метод для установки списка пользователей
  setUsers: (userList) => set(() => ({ users: userList })),
}))

export default useUserStore
