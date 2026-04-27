import { Anchor } from '@mantine/core'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ExplanationMarkdown({ content }: { content: string }) {
  return (
    <div
      className="ai-explain-md"
      style={{
        fontSize: 'var(--mantine-font-size-sm)',
        lineHeight: 1.55,
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p style={{ margin: '0 0 6px 0' }}>{children}</p>,
          ul: ({ children }) => (
            <ul style={{ margin: '4px 0 8px', paddingLeft: 22 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: '4px 0 8px', paddingLeft: 22 }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
          h1: ({ children }) => (
            <h3 style={{ margin: '8px 0 4px', fontSize: '1rem', fontWeight: 600 }}>
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 style={{ margin: '8px 0 4px', fontSize: '0.95rem', fontWeight: 600 }}>
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 style={{ margin: '6px 0 4px', fontSize: '0.9rem', fontWeight: 600 }}>
              {children}
            </h4>
          ),
          a: ({ href, children }) => (
            <Anchor href={href ?? '#'} target="_blank" rel="noreferrer">
              {children}
            </Anchor>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                margin: '6px 0',
                padding: '8px 10px',
                background: 'var(--mantine-color-default-hover)',
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 4,
                overflowX: 'auto',
                fontSize: '0.8rem',
                lineHeight: 1.45,
              }}
            >
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            const isBlock = !!className && className.startsWith('language-')
            if (isBlock) {
              return (
                <code style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                  {children}
                </code>
              )
            }
            return (
              <code
                style={{
                  background: 'var(--mantine-color-default-hover)',
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontSize: '0.85em',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                }}
              >
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: '6px 0',
                paddingLeft: 10,
                borderLeft: '2px solid var(--mantine-color-default-border)',
                color: 'var(--mantine-color-dimmed)',
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--mantine-color-default-border)',
                margin: '8px 0',
              }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
