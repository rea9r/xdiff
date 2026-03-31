import { IconArrowsDiff } from '@tabler/icons-react'
import { CompareModeHeaderActions } from './CompareModeHeaderActions'
import { HeaderRailGroup, HeaderRailPrimaryButton } from './HeaderRail'
import { RecentTargetsMenu, type RecentTargetsMenuItem } from './RecentTargetsMenu'

type CompareHeaderActionsProps = {
  kind: 'compare'
  loading?: boolean
  compareDisabled?: boolean
  onCompare: () => void
  optionsOpen: boolean
  onToggleOptions: () => void
  recentItems: RecentTargetsMenuItem[]
  onClearRecent: () => void
}

type FolderHeaderActionsProps = {
  kind: 'folder'
  loading?: boolean
  compareDisabled?: boolean
  onCompare: () => void
  recentItems: RecentTargetsMenuItem[]
  onClearRecent: () => void
}

type DesktopModeHeaderActionsProps = CompareHeaderActionsProps | FolderHeaderActionsProps

export function DesktopModeHeaderActions(props: DesktopModeHeaderActionsProps) {
  if (props.kind === 'compare') {
    return (
      <CompareModeHeaderActions
        loading={props.loading}
        compareDisabled={props.compareDisabled}
        onCompare={props.onCompare}
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
    <HeaderRailGroup className="compare-mode-header-actions">
      <HeaderRailPrimaryButton
        onClick={props.onCompare}
        loading={props.loading}
        disabled={props.compareDisabled}
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
