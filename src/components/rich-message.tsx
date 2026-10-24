import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** No raw HTML, executable content, or model-provided React components. */
export function RichMessage({ text }: { text: string }) {
  return (
    <div className="rich-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
