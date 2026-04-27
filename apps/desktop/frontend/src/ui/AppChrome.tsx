import { AppShell, Box, Burger, Group, ScrollArea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCheck } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { Mode } from '../types'
import { CodeFontScaleControl } from './CodeFontScaleControl'
import { HeaderRailGroup, HeaderRailSelect } from './HeaderRail'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'
import { ThemeModeControl } from './ThemeModeControl'

export type AppChromeLayoutMode = 'workspace' | 'sidebar'

type AppChromeProps = {
  mode: Mode
  onModeChange: (mode: Mode) => void
  layoutMode: AppChromeLayoutMode
  sidebar?: ReactNode
  main: ReactNode
  headerActions?: ReactNode
  inspector?: ReactNode
  inspectorOpen?: boolean
  tabBar?: ReactNode
}

const MODE_OPTIONS = [
  {
    group: 'Compare',
    items: [
      { value: 'text', label: 'Text compare' },
      { value: 'json', label: 'JSON compare' },
      { value: 'directory', label: 'Directory compare' },
    ],
  },
]

const NAVBAR_WIDTH_STORAGE_KEY = 'xdiff.desktop.navbarWidth'
const DEFAULT_NAVBAR_WIDTH = 320
const MIN_NAVBAR_WIDTH = 280
const MAX_NAVBAR_WIDTH = 460

function clampNavbarWidth(width: number): number {
  return Math.max(MIN_NAVBAR_WIDTH, Math.min(MAX_NAVBAR_WIDTH, width))
}

export function AppChrome({
  mode,
  onModeChange,
  layoutMode,
  sidebar,
  main,
  headerActions,
  inspector,
  inspectorOpen = false,
  tabBar,
}: AppChromeProps) {
  const isSidebarLayout = layoutMode === 'sidebar'
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false)
  const [navbarWidth, setNavbarWidth] = useState(DEFAULT_NAVBAR_WIDTH)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(DEFAULT_NAVBAR_WIDTH)
  const isResizingRef = useRef(false)

  useEffect(() => {
    if (!isSidebarLayout) {
      return
    }

    const raw = window.localStorage.getItem(NAVBAR_WIDTH_STORAGE_KEY)
    if (!raw) {
      return
    }

    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed)) {
      setNavbarWidth(clampNavbarWidth(parsed))
    }
  }, [isSidebarLayout])

  useEffect(() => {
    if (!isSidebarLayout) {
      return
    }

    window.localStorage.setItem(NAVBAR_WIDTH_STORAGE_KEY, String(navbarWidth))
  }, [isSidebarLayout, navbarWidth])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isResizingRef.current) {
        return
      }

      const delta = event.clientX - resizeStartXRef.current
      setNavbarWidth(clampNavbarWidth(resizeStartWidthRef.current + delta))
    }

    const onPointerUp = () => {
      if (!isResizingRef.current) {
        return
      }

      isResizingRef.current = false
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    isResizingRef.current = true
    resizeStartXRef.current = event.clientX
    resizeStartWidthRef.current = navbarWidth
  }

  const resetNavbarWidth = () => {
    setNavbarWidth(DEFAULT_NAVBAR_WIDTH)
  }

  return (
    <AppShell
      header={{ height: 44 }}
      navbar={
        isSidebarLayout
          ? {
            width: navbarWidth,
            breakpoint: 'md',
            collapsed: { mobile: !mobileOpened },
          }
          : undefined
      }
      padding="md"
    >
      <AppShell.Header>
        <Group justify="space-between" h="100%" px={6}>
          <HeaderRailGroup>
            {isSidebarLayout ? (
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="md"
                size="sm"
                className="xdiff-header-burger"
                aria-label="Toggle navigation"
              />
            ) : null}
            <HeaderRailSelect
              w={220}
              className="xdiff-header-mode-select"
              data={MODE_OPTIONS}
              withCheckIcon={false}
              renderOption={({ option, checked }: { option: { label: string }; checked: boolean }) => (
                <div className="mode-option-row">
                  <span className="mode-option-check-slot" aria-hidden="true">
                    {checked ? <IconCheck size={14} className="mode-option-check-icon" /> : null}
                  </span>
                  <span className="mode-option-label">{option.label}</span>
                </div>
              )}
              value={mode}
              onChange={(value: string | null) => {
                if (!value) {
                  return
                }
                onModeChange(value as Mode)
                if (isSidebarLayout) {
                  closeMobile()
                }
              }}
            />
          </HeaderRailGroup>
          <HeaderRailGroup>
            {headerActions}
            <CodeFontScaleControl />
            <ThemeModeControl />
          </HeaderRailGroup>
        </Group>
      </AppShell.Header>

      {isSidebarLayout ? (
        <AppShell.Navbar p="md">
          <AppShell.Section grow component={ScrollArea}>
            <Box pr="xs" className="control-panel">
              {sidebar}
            </Box>
          </AppShell.Section>
          <div
            className="app-navbar-resizer"
            onPointerDown={startResize}
            onDoubleClick={resetNavbarWidth}
            aria-hidden="true"
          />
        </AppShell.Navbar>
      ) : null}

      <AppShell.Main>
        {tabBar}
        {isSidebarLayout ? (
          main
        ) : (
          <div className={`workspace-shell ${inspectorOpen ? 'with-inspector' : ''}`}>
            <div className="workspace-main">{main}</div>
            {inspectorOpen && inspector ? (
              <aside className="workspace-inspector">{inspector}</aside>
            ) : null}
          </div>
        )}
      </AppShell.Main>

      <KeyboardShortcutsHelp />
    </AppShell>
  )
}
