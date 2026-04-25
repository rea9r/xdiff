import { createTheme } from '@mantine/core'

export const appTheme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  colors: {
    diffAdd: [
      '#eefbf1',
      '#def5e5',
      '#c2eccc',
      '#9ae0aa',
      '#6fd285',
      '#4bc465',
      '#37b655',
      '#289345',
      '#1f7436',
      '#17592a',
    ],
    diffRemove: [
      '#fff1f1',
      '#ffe1e1',
      '#ffc7c7',
      '#ffa0a0',
      '#ff7474',
      '#f84f4f',
      '#e03131',
      '#b42323',
      '#8d1a1a',
      '#6d1313',
    ],
    diffChange: [
      '#fff7e8',
      '#ffefcc',
      '#ffe29c',
      '#ffd066',
      '#ffbf3d',
      '#ffb11f',
      '#f59f00',
      '#c27d00',
      '#946000',
      '#6b4500',
    ],
  },
})
