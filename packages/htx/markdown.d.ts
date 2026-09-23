// @htx/htx/markdown - type declarations

import type { H } from './index.d.ts';

/** a marked-shaped token. only `type` is relied on across all of them. */
export interface MarkdownToken {
  type: string;
  raw?: string;
  text?: string;
  tokens?: MarkdownToken[];
  [key: string]: any;
}

/** walks child tokens; `top` marks a block context, where bare text becomes a paragraph. */
export type MarkdownWalk = (tokens: MarkdownToken[] | undefined, top?: boolean) => unknown[];

export interface MarkdownOptions {
  /** src -> tokens. pass marked.lexer bare, options replace marked's defaults. */
  lexer: (src: string) => MarkdownToken[];
  /** raw html inside the markdown: 'skip' drops it, 'text' shows it, 'raw' parses it (unsafe). default 'skip'. */
  html?: 'skip' | 'text' | 'raw';
  /** a newline inside a paragraph becomes a <br>. default false. */
  breaks?: boolean;
  /** per token type, for marked extensions. */
  handlers?: Record<string, (token: MarkdownToken, walk: MarkdownWalk) => unknown>;
}

/** returns src -> one fragment holding the whole document. */
export function createMarkdown<T = unknown>(
  h: H<T>,
  Fragment: unknown,
  options: MarkdownOptions,
): (src?: string | null) => T;

export default createMarkdown;
