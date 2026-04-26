import { useEffect, useRef, type MutableRefObject } from 'react'

type Options = {
  enabled: boolean
  searchInputRef: MutableRefObject<HTMLInputElement | null>
  canFocusSearch: boolean
  onMoveSearch?: (direction: 1 | -1) => void
  onMoveDiff?: (direction: 1 | -1) => void
  onUndo?: () => void
  onRedo?: () => void
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
  onUndo,
  onRedo,
}: Options) {
  const onMoveSearchRef = useRef(onMoveSearch)
  const onMoveDiffRef = useRef(onMoveDiff)
  const onUndoRef = useRef(onUndo)
  const onRedoRef = useRef(onRedo)
  onMoveSearchRef.current = onMoveSearch
  onMoveDiffRef.current = onMoveDiff
  onUndoRef.current = onUndo
  onRedoRef.current = onRedo

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
        return
      }

      if (ctrlOrCmd && !event.altKey && event.key.toLowerCase() === 'z') {
        if (isEditableTarget(event.target) || isInsideCodeMirror(event.target)) {
          return
        }
        if (event.shiftKey) {
          if (!onRedoRef.current) {
            return
          }
          event.preventDefault()
          onRedoRef.current()
          return
        }
        if (!onUndoRef.current) {
          return
        }
        event.preventDefault()
        onUndoRef.current()
        return
      }

      if (
        ctrlOrCmd &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'y'
      ) {
        if (isEditableTarget(event.target) || isInsideCodeMirror(event.target)) {
          return
        }
        if (!onRedoRef.current) {
          return
        }
        event.preventDefault()
        onRedoRef.current()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, canFocusSearch, searchInputRef])
}
