import type {
  DesktopRecentFolderPair,
  DesktopRecentPair,
  DesktopRecentScenarioPath,
} from './types'

const MAX_RECENT_ENTRIES = 10

function trimValue(value: string): string {
  return value.trim()
}

export function upsertRecentPair(
  prev: DesktopRecentPair[],
  next: DesktopRecentPair,
): DesktopRecentPair[] {
  const oldPath = trimValue(next.oldPath)
  const newPath = trimValue(next.newPath)
  if (!oldPath || !newPath) {
    return prev
  }

  const updated: DesktopRecentPair = {
    oldPath,
    newPath,
    usedAt: next.usedAt,
  }

  const deduped = prev.filter((item) => !(item.oldPath === oldPath && item.newPath === newPath))
  return [updated, ...deduped].slice(0, MAX_RECENT_ENTRIES)
}

export function upsertRecentFolderPair(
  prev: DesktopRecentFolderPair[],
  next: DesktopRecentFolderPair,
): DesktopRecentFolderPair[] {
  const leftRoot = trimValue(next.leftRoot)
  const rightRoot = trimValue(next.rightRoot)
  const currentPath = trimValue(next.currentPath)
  const viewMode = next.viewMode === 'tree' ? 'tree' : 'list'
  if (!leftRoot || !rightRoot) {
    return prev
  }

  const updated: DesktopRecentFolderPair = {
    leftRoot,
    rightRoot,
    currentPath,
    viewMode,
    usedAt: next.usedAt,
  }

  const deduped = prev.filter(
    (item) =>
      !(
        item.leftRoot === leftRoot &&
        item.rightRoot === rightRoot &&
        item.currentPath === currentPath &&
        item.viewMode === viewMode
      ),
  )
  return [updated, ...deduped].slice(0, MAX_RECENT_ENTRIES)
}

export function upsertRecentScenarioPath(
  prev: DesktopRecentScenarioPath[],
  next: DesktopRecentScenarioPath,
): DesktopRecentScenarioPath[] {
  const path = trimValue(next.path)
  const reportFormat = next.reportFormat === 'json' ? 'json' : 'text'
  if (!path) {
    return prev
  }

  const updated: DesktopRecentScenarioPath = {
    path,
    reportFormat,
    usedAt: next.usedAt,
  }

  const deduped = prev.filter(
    (item) => !(item.path === path && item.reportFormat === reportFormat),
  )
  return [updated, ...deduped].slice(0, MAX_RECENT_ENTRIES)
}
