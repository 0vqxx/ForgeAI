import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Code block with Copy + Download buttons                             */
/* ------------------------------------------------------------------ */
function CodeBlock({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const ext = language || "txt";
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snippet.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="group relative my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] text-sm">
      {/* header bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-1.5">
        <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/40 transition hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-400" />
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      {/* code body */}
      <pre className="overflow-x-auto p-4">
        <code className={`language-${language} text-[13px] leading-relaxed`}>
          {code}
        </code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main markdown renderer                                               */
/* ------------------------------------------------------------------ */
export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-forge">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          /* Code blocks */
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const codeString = String(children);
            const code = codeString.replace(/\n$/, "");

            // In react-markdown v9, 'inline' is no longer passed. 
            // We can determine if it's a block by checking if it has a language, 
            // contains a newline, or spans multiple lines in the AST.
            const isBlock = 
              !!match || 
              codeString.includes("\n") || 
              (node?.position?.start?.line !== node?.position?.end?.line);

            if (isBlock) {
              return <CodeBlock language={language} code={code} />;
            }
            // inline code
            return (
              <code
                className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-orange-300"
                {...props}
              >
                {children}
              </code>
            );
          },

          /* Headings */
          h1: ({ children }) => (
            <h1 className="mb-2 mt-4 text-xl font-bold text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-lg font-bold text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-3 text-base font-semibold text-foreground">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-1 mt-2 text-sm font-semibold text-foreground">{children}</h4>
          ),

          /* Paragraphs */
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed text-foreground/90 last:mb-0">{children}</p>
          ),

          /* Lists */
          ul: ({ children }) => (
            <ul className="mb-2 ml-4 list-disc space-y-1 text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-4 list-decimal space-y-1 text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          /* Blockquote */
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-orange-400/50 pl-4 text-foreground/70 italic">
              {children}
            </blockquote>
          ),

          /* Horizontal rule */
          hr: () => <hr className="my-3 border-white/10" />,

          /* Table */
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/5 text-foreground/70">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-white/10 px-4 py-2">{children}</td>
          ),

          /* Links */
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
            >
              {children}
            </a>
          ),

          /* Strong / Em */
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/80">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
