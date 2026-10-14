// @htx/htx - type declarations

/** props as the core hands them to h(): merged, class joined, style merged. */
export type Props = Record<string, any>;

/**
 * the adapter's hyperscript, called bottom up. `this` carries htm's staticness
 * bit field; an adapter may ignore it but should pass it on.
 */
export type H<T = unknown> = (this: unknown, type: any, props: Props | null, ...children: any[]) => T;

/**
 * a tag spec is a tag name, a component, or a full spec. defined under '$name'
 * it is a shorthand and needs its tag; under a camelCase name it is the real
 * tag of that name in kebab-case, and `tag` only renders it as another one.
 */
export type ShorthandSpec =
  | string
  | ((...args: any[]) => any)
  | {
    tag?: string | ((...args: any[]) => any);
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

  /** define('$icon', spec), define('inputColor', spec) or define({ $icon: spec, inputColor: spec }). chains. */
  define(name: string, spec: ShorthandSpec): Htx<T>;
  define(tags: ShorthandRegistry): Htx<T>;

  /** the live registry, keyed '$icon' for shorthands and 'input-color' for real tags. */
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

/** a value in a program: static, a hole (the nth interpolated value), or text and holes joined. */
export type ProgramValue = unknown | { hole: number } | { parts: (string | { hole: number })[] };

/** a node of a program: text, a child hole, or an element. */
export type ProgramNode =
  | string
  | { hole: number }
  | {
    tag      : string | ((...args: any[]) => any) | { hole: number };
    props    : ([string | symbol, ProgramValue] | { spread: number })[];
    children : ProgramNode[];
  };

/** a parsed template as a tree with numbered holes, for renderers such as @domina/render. */
export interface Program {
  nodes: ProgramNode[];
}

/**
 * the program of a template literal, cached per literal and registry. tag selectors,
 * prop groups, static shorthand tags and positional values are resolved.
 */
export function program(statics: TemplateStringsArray | readonly string[], tags?: ShorthandRegistry | null): Program;
