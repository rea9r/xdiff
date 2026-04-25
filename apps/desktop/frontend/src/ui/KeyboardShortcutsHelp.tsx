import { Modal } from '@mantine/core'
import { useEffect, useState } from 'react'

type ShortcutGroup = {
  title: string
  items: Array<{ keys: string[]; label: string }>
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Search',
    items: [
      { keys: ['⌘/Ctrl', 'F'], label: 'Focus search' },
      { keys: ['F3'], label: 'Next match' },
      { keys: ['Shift', 'F3'], label: 'Previous match' },
      { keys: ['Enter'], label: 'Next match (in search)' },
      { keys: ['Shift', 'Enter'], label: 'Previous match (in search)' },
      { keys: ['Esc'], label: 'Clear / blur search' },
    ],
  },
  {
    title: 'Diff navigation',
    items: [
      { keys: ['Alt', '↓'], label: 'Next diff block' },
      { keys: ['Alt', '↑'], label: 'Previous diff block' },
    ],
  },
  {
    title: 'Directory compare',
    items: [
      { keys: ['↓'], label: 'Select next entry' },
      { keys: ['↑'], label: 'Select previous entry' },
      { keys: ['Enter'], label: 'Open diff / enter directory' },
      { keys: ['Backspace'], label: 'Up to parent directory' },
    ],
  },
  {
    title: 'Help',
    items: [{ keys: ['?'], label: 'Show this help' }],
  },
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return true
  }
  return target.isContentEditable
}

export function KeyboardShortcutsHelp() {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }
      if (event.key !== '?') {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }
      event.preventDefault()
      setOpened((prev) => !prev)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Keyboard shortcuts"
      size="md"
      centered
    >
      <div className="shortcut-help">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} className="shortcut-help-group">
            <div className="shortcut-help-title">{group.title}</div>
            <ul className="shortcut-help-list">
              {group.items.map((item, index) => (
                <li key={index} className="shortcut-help-row">
                  <span className="shortcut-help-keys">
                    {item.keys.map((k, i) => (
                      <span key={i} className="shortcut-help-key">
                        {k}
                      </span>
                    ))}
                  </span>
                  <span className="shortcut-help-label">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
