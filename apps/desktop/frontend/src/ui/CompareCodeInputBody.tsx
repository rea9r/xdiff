import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'

type CompareCodeInputLanguage = 'json' | 'yaml'

type CompareCodeInputBodyProps = {
  value: string
  onChange: (value: string) => void
  language: CompareCodeInputLanguage
  parseError?: string | null
  placeholder?: string
  helperText?: string
}

export function CompareCodeInputBody({
  value,
  onChange,
  language,
  parseError = null,
  placeholder,
  helperText,
}: CompareCodeInputBodyProps) {
  const extensions = useMemo(() => [language === 'json' ? json() : yaml()], [language])
  const label = language === 'json' ? 'JSON' : 'YAML'
  const defaultPlaceholder =
    language === 'json' ? 'Paste or edit JSON here' : 'Paste or edit OpenAPI YAML here'
  const resolvedPlaceholder = placeholder ?? defaultPlaceholder
  const resolvedHelperText = helperText ?? 'Open file, paste clipboard, or edit directly'
  const showPlaceholder = value.trim().length === 0

  return (
    <div className="compare-code-input-body-wrap">
      <div className="compare-code-input-shell">
        <div className="compare-code-input-language">{label}</div>
        {showPlaceholder ? (
          <div className="compare-code-input-placeholder">{resolvedPlaceholder}</div>
        ) : null}
        <div className="compare-code-input-body" data-language={language}>
          <CodeMirror
            value={value}
            height="220px"
            extensions={extensions}
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
        </div>
      </div>
      <div className="compare-code-input-meta">
        {!parseError ? (
          <div className="compare-code-input-helper">{resolvedHelperText}</div>
        ) : null}
        {parseError ? (
          <div className="compare-code-input-error">
            Invalid {label}: {parseError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
