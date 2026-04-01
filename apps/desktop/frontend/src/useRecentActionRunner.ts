import { useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { formatUnknownError } from './utils/appHelpers'

type UseRecentActionRunnerOptions = {
  setLoading: (value: boolean) => void
}

export function useRecentActionRunner({ setLoading }: UseRecentActionRunnerOptions) {
  const runRecentAction = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setLoading(true)
      try {
        await action()
      } catch (error) {
        notifications.show({
          title: `${label} failed`,
          message: formatUnknownError(error),
          color: 'red',
        })
      } finally {
        setLoading(false)
      }
    },
    [setLoading],
  )

  return {
    runRecentAction,
  }
}
