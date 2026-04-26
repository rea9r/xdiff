import { notifications } from '@mantine/notifications'

export function showErrorNotification(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'red',
  })
}

export function showSuccessNotification(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'green',
  })
}

export function showWarningNotification(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: 'yellow',
  })
}

export function showClipboardUnavailableNotification() {
  showErrorNotification('Clipboard unavailable', 'Clipboard runtime is not available.')
}

export function showClipboardEmptyNotification() {
  showWarningNotification('Clipboard is empty', 'Nothing to paste.')
}

export function showAdoptNotification(direction: 'to-new' | 'to-old') {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)
  const undoShortcut = isMac ? '⌘Z' : 'Ctrl+Z'
  const directionLabel = direction === 'to-new' ? 'OLD → NEW' : 'NEW → OLD'
  notifications.show({
    id: 'text-adopt',
    title: `Adopted (${directionLabel})`,
    message: `Press ${undoShortcut} to undo.`,
    color: 'blue',
    autoClose: 2500,
  })
}
