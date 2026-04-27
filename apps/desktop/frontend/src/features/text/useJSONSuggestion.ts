import { useEffect, useRef, useState } from 'react'

const JSON_SUGGESTION_DEBOUNCE_MS = 500
const MIN_DETECTABLE_LENGTH = 2

export function isLikelyJSON(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length < MIN_DETECTABLE_LENGTH) {
    return false
  }
  const first = trimmed[0]
  if (first !== '{' && first !== '[') {
    return false
  }
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

export type JSONSuggestion = {
  shouldShow: boolean
  dismiss: () => void
}

export function useJSONSuggestion(
  oldValue: string,
  newValue: string,
  debounceMs: number = JSON_SUGGESTION_DEBOUNCE_MS,
): JSONSuggestion {
  const [shouldShow, setShouldShow] = useState(false)
  const dismissedRef = useRef<{ oldValue: string; newValue: string } | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const bothValid = isLikelyJSON(oldValue) && isLikelyJSON(newValue)
      const dismissed = dismissedRef.current
      const sameAsDismissed =
        dismissed !== null &&
        dismissed.oldValue === oldValue &&
        dismissed.newValue === newValue
      setShouldShow(bothValid && !sameAsDismissed)
    }, debounceMs)

    return () => {
      window.clearTimeout(handle)
    }
  }, [oldValue, newValue, debounceMs])

  const dismiss = () => {
    dismissedRef.current = { oldValue, newValue }
    setShouldShow(false)
  }

  return { shouldShow, dismiss }
}
