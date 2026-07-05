import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchActiveAbsences, buildAbsencesMap } from './userAbsenceUtils'

/**
 * Загружает активные отсутствия сотрудников и предоставляет map для быстрой проверки.
 */
export function useActiveAbsences(enabled = true) {
  const [absences, setAbsences] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const data = await fetchActiveAbsences()
      setAbsences(data)
    } catch (err) {
      console.error('Ошибка загрузки активных отсутствий:', err)
      setAbsences([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    reload()
  }, [reload])

  const absencesMap = useMemo(() => buildAbsencesMap(absences), [absences])

  return { absences, absencesMap, loading, reload }
}
