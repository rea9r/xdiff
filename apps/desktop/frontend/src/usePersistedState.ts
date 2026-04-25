import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) {
        return defaultValue
      }
      const parsed = JSON.parse(raw) as unknown
      return isValid(parsed) ? parsed : defaultValue
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore storage errors
    }
  }, [key, value])

  return [value, setValue]
}
