import { useEffect, useRef, type MutableRefObject } from 'react'

type Options = {
  enabled: boolean
  searchInputRef: MutableRefObject<HTMLInputElement | null>
  canFocusSearch: boolean
  onMoveSearch?: (direction: 1 | -1) => void
  onMoveDiff?: (direction: 1 | -1) => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return true
  }
  return target.isContentEditable
}

function isInsideCodeMirror(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  return !!target.closest('.cm-editor')
}

export function useCompareKeyboardShortcuts({
  enabled,
  searchInputRef,
  canFocusSearch,
  onMoveSearch,
  onMoveDiff,
}: Options) {
  const onMoveSearchRef = useRef(onMoveSearch)
  const onMoveDiffRef = useRef(onMoveDiff)
  onMoveSearchRef.current = onMoveSearch
  onMoveDiffRef.current = onMoveDiff

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey && event.altKey) {
        return
      }

      const ctrlOrCmd = event.ctrlKey || event.metaKey

      if (ctrlOrCmd && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        if (!canFocusSearch) {
          return
        }
        if (isInsideCodeMirror(event.target)) {
          return
        }
        event.preventDefault()
        const input = searchInputRef.current
        if (input) {
          input.focus()
          input.select()
        }
        return
      }

      if (event.key === 'F3' && !event.altKey && !ctrlOrCmd) {
        if (!onMoveSearchRef.current) {
          return
        }
        event.preventDefault()
        onMoveSearchRef.current(event.shiftKey ? -1 : 1)
        return
      }

      if (
        event.altKey &&
        !ctrlOrCmd &&
        !event.shiftKey &&
        (event.key === 'ArrowDown' || event.key === 'ArrowUp')
      ) {
        if (!onMoveDiffRef.current) {
          return
        }
        if (isEditableTarget(event.target)) {
          return
        }
        event.preventDefault()
        onMoveDiffRef.current(event.key === 'ArrowDown' ? 1 : -1)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, canFocusSearch, searchInputRef])
}
