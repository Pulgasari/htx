// @htx/htx - type declarations

/** props as the core hands them to h(): merged, class joined, style merged. */
export type Props = Record<string, any>;

/**
 * the adapter's hyperscript, called bottom up. `this` carries htm's staticness
 * bit field; an adapter may ignore it but should pass it on.
 */
export type H<T = unknown> = (this: unknown, type: any, props: Props | null, ...children: any[]) => T;

/** a shorthand is a tag name, a component, or a full spec. */
export type ShorthandSpec =
  | string
  | ((...args: any[]) => any)
  | {
    tag: string | ((...args: any[]) => any);
    /** names the positional values fill, in order. a single name needs no array. */
    args?: string | string[];
    /** defaults. a written attribute wins, class and style append. */
    props?: Props;
  };

export type ShorthandRegistry = Record<string, ShorthandSpec>;

export interface HtxOptions {
  /** cache fully static subtrees. true for a vdom, false for real dom nodes. default true. */
  memo?: boolean;
  /** seeds the shorthand registry. */
  tags?: ShorthandRegistry;
}

/** the tag function returned by createHTX(). */
export interface Htx<T = unknown> {
  /** one root yields the node, several roots yield an array. */
  (strings: TemplateStringsArray, ...values: unknown[]): T | T[];

  /** define('icon', spec) or define({ icon: spec, box: spec }). chains. */
  define(name: string, spec: ShorthandSpec): Htx<T>;
  define(tags: ShorthandRegistry): Htx<T>;

  /** the live shorthand registry. */
  readonly tags: ShorthandRegistry;

  /** attaches helpers to the tag function. 'define', 'tags' and 'use' are refused. chains. */
  use(name: string, fn: (...args: any[]) => any): Htx<T>;
  use(helpers: Record<string, (...args: any[]) => any>): Htx<T>;

  /** helpers attached via use(), e.g. html.md(text). */
  [helper: string]: any;
}

/** builds a tag function around an adapter's h() and fragment type. */
export function createHTX<T = unknown>(h: H<T>, Fragment: unknown, options?: HtxOptions): Htx<T>;

/** alias of createHTX. */
export const createHtml: typeof createHTX;

/** compiles the statics of a template into the cached op program. low level. */
export function build(statics: TemplateStringsArray | readonly string[]): unknown[];

/** runs a built program against h(). low level. */
export function evaluate<T = unknown>(
  h: H<T>,
  built: unknown[],
  fields: ArrayLike<unknown>,
  args: unknown[],
  memo?: boolean,
): unknown[];

/** key under which quoted and bare interpolated values of a tag are collected. */
export const POSITIONAL: unique symbol;

/** the raw-html escape hatch, for the spread form: ...${{ [RAW_HTML]: markup }}. */
export const RAW_HTML: '!html';

export default createHTX;
