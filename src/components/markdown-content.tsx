import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Shared presentation for model answers and Notion source excerpts. */
export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          table: ({ node: _node, ...props }) => (
            <div
              className="overflow-x-auto"
              tabIndex={0}
              role="region"
              aria-label="Scrollable table"
            >
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
