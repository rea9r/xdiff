import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useComputedColorScheme } from '@mantine/core'
import type { Extension } from '@codemirror/state'
import {
  createDiffCodeEditorTheme,
  createDiffCodeHighlightStyle,
} from './codeEditorTheme'

const LazyCodeMirror = lazy(() => import('@uiw/react-codemirror'))

type DiffCodeInputBodyProps = {
  value: string
  onChange: (value: string) => void
  parseError?: string | null
  placeholder?: string
  helperText?: string
}

export function DiffCodeInputBody({
  value,
  onChange,
  parseError = null,
  placeholder,
  helperText,
}: DiffCodeInputBodyProps) {
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
    () => createDiffCodeEditorTheme(computedColorScheme === 'dark' ? 'dark' : 'light'),
    [computedColorScheme],
  )
  const editorHighlight = useMemo(
    () => createDiffCodeHighlightStyle(computedColorScheme === 'dark' ? 'dark' : 'light'),
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
    <div className="diff-code-input-body-wrap">
      <div className="diff-code-input-shell">
        <div className="diff-code-input-language">JSON</div>
        {showPlaceholder ? (
          <div className="diff-code-input-placeholder">{resolvedPlaceholder}</div>
        ) : null}
        <div className="diff-code-input-body">
          {languageExtension ? (
            <Suspense
              fallback={
                <textarea
                  className="diff-text-input"
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
              className="diff-text-input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              spellCheck={false}
            />
          )}
        </div>
      </div>
      <div className="diff-code-input-meta">
        {!parseError ? (
          <div className="diff-code-input-helper" title={resolvedHelperText}>
            {resolvedHelperText}
          </div>
        ) : null}
        {parseError ? (
          <div
            className="diff-code-input-error"
            title={`Invalid JSON: ${parseError}`}
          >
            Invalid JSON: {parseError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
