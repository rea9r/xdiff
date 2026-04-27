import { IconArrowsDiff } from '@tabler/icons-react'
import { DiffModeHeaderActions } from './DiffModeHeaderActions'
import { HeaderRailGroup, HeaderRailPrimaryButton } from './HeaderRail'
import { RecentTargetsMenu, type RecentTargetsMenuItem } from './RecentTargetsMenu'

type DiffHeaderActionsProps = {
  kind: 'diff'
  loading?: boolean
  diffDisabled?: boolean
  onDiff: () => void
  optionsOpen: boolean
  onToggleOptions: () => void
  recentItems: RecentTargetsMenuItem[]
  onClearRecent: () => void
}

type DirectoryHeaderActionsProps = {
  kind: 'directory'
  loading?: boolean
  diffDisabled?: boolean
  onDiff: () => void
  recentItems: RecentTargetsMenuItem[]
  onClearRecent: () => void
}

type DesktopModeHeaderActionsProps = DiffHeaderActionsProps | DirectoryHeaderActionsProps

export function DesktopModeHeaderActions(props: DesktopModeHeaderActionsProps) {
  if (props.kind === 'diff') {
    return (
      <DiffModeHeaderActions
        loading={props.loading}
        diffDisabled={props.diffDisabled}
        onDiff={props.onDiff}
        optionsOpen={props.optionsOpen}
        onToggleOptions={props.onToggleOptions}
        extraActions={
          <RecentTargetsMenu
            buttonLabel="Recent"
            disabled={props.recentItems.length === 0}
            items={props.recentItems}
            onClear={props.onClearRecent}
          />
        }
      />
    )
  }

  return (
    <HeaderRailGroup className="diff-mode-header-actions">
      <HeaderRailPrimaryButton
        onClick={props.onDiff}
        loading={props.loading}
        disabled={props.diffDisabled}
        leftSection={<IconArrowsDiff size={14} />}
      >
        Compare
      </HeaderRailPrimaryButton>
      <RecentTargetsMenu
        buttonLabel="Recent roots"
        disabled={props.recentItems.length === 0}
        items={props.recentItems}
        onClear={props.onClearRecent}
      />
    </HeaderRailGroup>
  )
}
