import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useComputedColorScheme } from '@mantine/core'
import type { Extension } from '@codemirror/state'
import {
  createCompareCodeEditorTheme,
  createCompareCodeHighlightStyle,
} from './codeEditorTheme'

const LazyCodeMirror = lazy(() => import('@uiw/react-codemirror'))

type CompareCodeInputBodyProps = {
  value: string
  onChange: (value: string) => void
  parseError?: string | null
  placeholder?: string
  helperText?: string
}

export function CompareCodeInputBody({
  value,
  onChange,
  parseError = null,
  placeholder,
  helperText,
}: CompareCodeInputBodyProps) {
  const [languageExtension, setLanguageExtension] = useState<Extension | null>(null)

  useEffect(() => {
    let disposed = false

    const loadLanguageExtension = async () => {
      const module = await import('@codemirror/lang-json')
      if (!disposed) {
        setLanguageExtension(module.json())
      }
    }

    setLanguageExtension(null)
    void loadLanguageExtension()

    return () => {
      disposed = true
    }
  }, [])

  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const editorTheme = useMemo(
    () => createCompareCodeEditorTheme(computedColorScheme === 'dark' ? 'dark' : 'light'),
    [computedColorScheme],
  )
  const editorHighlight = useMemo(
    () => createCompareCodeHighlightStyle(computedColorScheme === 'dark' ? 'dark' : 'light'),
    [computedColorScheme],
  )
  const editorExtensions = useMemo(
    () => (languageExtension ? [languageExtension, editorTheme, editorHighlight] : []),
    [languageExtension, editorTheme, editorHighlight],
  )
  const resolvedPlaceholder = placeholder ?? 'Paste or edit JSON here'
  const resolvedHelperText = helperText ?? 'Open file, paste clipboard, or edit directly'
  const showPlaceholder = value.trim().length === 0

  return (
    <div className="compare-code-input-body-wrap">
      <div className="compare-code-input-shell">
        <div className="compare-code-input-language">JSON</div>
        {showPlaceholder ? (
          <div className="compare-code-input-placeholder">{resolvedPlaceholder}</div>
        ) : null}
        <div className="compare-code-input-body">
          {languageExtension ? (
            <Suspense
              fallback={
                <textarea
                  className="compare-text-input"
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  spellCheck={false}
                />
              }
            >
              <LazyCodeMirror
                value={value}
                height="220px"
                extensions={editorExtensions}
                onChange={onChange}
                basicSetup={{
                  lineNumbers: false,
                  foldGutter: false,
                  highlightActiveLine: false,
                  highlightActiveLineGutter: false,
                  autocompletion: false,
                  searchKeymap: true,
                }}
              />
            </Suspense>
          ) : (
            <textarea
              className="compare-text-input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
            />
          )}
        </div>
      </div>
      <div className="compare-code-input-meta">
        {!parseError ? (
          <div className="compare-code-input-helper">{resolvedHelperText}</div>
        ) : null}
        {parseError ? (
          <div className="compare-code-input-error">
            Invalid JSON: {parseError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
