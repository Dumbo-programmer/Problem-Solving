import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders a string containing `$…$` inline maths (and `$$…$$` display maths)
 * with KaTeX. Anything outside the delimiters is emitted as plain text, so the
 * bilingual problem statements render exactly as authored.
 */

interface Piece {
  type: "text" | "math";
  value: string;
  display: boolean;
}

const DELIM_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function splitMath(input: string): Piece[] {
  const pieces: Piece[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  DELIM_RE.lastIndex = 0;
  while ((m = DELIM_RE.exec(input))) {
    if (m.index > last) pieces.push({ type: "text", value: input.slice(last, m.index), display: false });
    const display = m[1] !== undefined;
    pieces.push({ type: "math", value: (display ? m[1] : m[2]) ?? "", display });
    last = m.index + m[0].length;
  }
  if (last < input.length) pieces.push({ type: "text", value: input.slice(last), display: false });
  return pieces;
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html"
    });
  } catch {
    return tex;
  }
}

interface Props {
  children: string;
  /** Optional class applied to the outer wrapper. */
  className?: string;
  /** Render block-level maths centred (used for solution bodies). */
  block?: boolean;
}

export default function MathText({ children, className = "", block = false }: Props) {
  const pieces = useMemo(() => splitMath(children), [children]);

  if (block) {
    return (
      <div className={`space-y-1 ${className}`} dangerouslySetInnerHTML={{ __html: pieces.map((p) => (p.type === "math" ? renderMath(p.value, p.display) : escapeHtml(p.value))).join("") }} />
    );
  }

  return (
    <span className={className}>
      {pieces.map((p, i) =>
        p.type === "math" ? (
          <span key={i} className="katex-inline" dangerouslySetInnerHTML={{ __html: renderMath(p.value, p.display) }} />
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </span>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}
