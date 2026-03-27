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
}

export function CompareCodeInputBody({
  value,
  onChange,
  language,
  parseError = null,
}: CompareCodeInputBodyProps) {
  const extensions = useMemo(() => [language === 'json' ? json() : yaml()], [language])
  const label = language === 'json' ? 'JSON' : 'YAML'

  return (
    <div className="compare-code-input-body-wrap">
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
      <div className="compare-code-input-meta">
        {parseError ? (
          <div className="compare-code-input-error">
            Invalid {label}: {parseError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
