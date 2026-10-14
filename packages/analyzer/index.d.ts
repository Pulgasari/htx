/**
 * htx templates as data for editor tooling: scan a template with offsets, check
 * it against html, custom elements manifests and the html.define() registry,
 * and answer completion, hover and definition at an offset.
 *
 * @module
 */

/** A static part of a template and the offset it starts at in the source file. */
export interface Static { start: number; text: string }

/** The range of a hole (`${…}`, including the braces) in the source file. */
export interface Range { start: number; end: number }

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic extends Range { code: string; message: string; severity: Severity }

export interface Attribute extends Range {
  name?       : string;
  names?      : string[];
  nameEnd?    : number;
  positional? : boolean;
  spread?     : boolean;
  value       : { kind: 'true' } | { kind: 'string'; text: string; quoted: boolean; start: number; end: number } | { kind: 'hole'; hole: number; start: number; end: number } | { kind: 'parts'; parts: (string | { hole: number })[]; start: number; end: number };
}

export interface Element extends Range {
  type        : 'element';
  name        : string;
  tag         : string;
  id          : { name: string; start: number; end: number } | null;
  classes     : { name: string; start: number; end: number }[];
  nameRange   : Range;
  tagHole?    : number;
  fragment?   : boolean;
  attributes  : Attribute[];
  children    : Node[];
  openEnd?    : number;
  close?      : Range;
  selfClosing?: boolean;
}

export type Node = Element | { type: 'text'; text: string; blank: boolean; start: number; end: number } | { type: 'hole'; hole: number; start: number; end: number } | { type: 'comment'; start: number; end: number };

/** What a hole is for: child, tag, spread, positional, event, ref, raw, class, style, prop, part, closing, comment. */
export interface Hole extends Range { hole: number; role: string; element?: Element | null; names?: string[] }

export interface Region extends Range { kind: 'tagName' | 'attrName' | 'attrValue' | 'closeName' | 'tag' | 'text'; element?: Element; attribute?: Attribute }

export interface Template extends Range {
  nodes   : Node[];
  errors  : Diagnostic[];
  holes   : Hole[];
  regions : Region[];
}

export interface ElementInfo {
  kind        : 'html' | 'svg' | 'custom' | 'custom-unknown' | 'unknown' | 'unknown-shorthand' | 'component' | 'dynamic' | 'fragment';
  tag         : string;
  description : string;
  attributes  : Map<string, { name: string; type: string | null; values: string[] | null; description: string }>;
  members     : Map<string, { name: string; type: string | null; description: string }>;
  events      : { name: string; description: string }[];
  slots       : { name: string; description: string }[];
  link?       : string;
  module?     : string;
  source?     : string | null;
  via?        : TagEntry | null;
}

/** A registry entry, as html.define() would hold it. */
export interface TagEntry {
  key       : string;
  name      : string;
  tag       : string | null;
  component : string | null;
  args      : string[];
  props     : Record<string, unknown>;
  location  : { file: string; start: number; end: number } | null;
}

export interface Context {
  custom   : Map<string, ElementInfo>;
  registry : Map<string, TagEntry>;
  partial  : boolean;
  resolve (element: Element): ElementInfo;
  tag (name: string): ElementInfo;
}

export interface ContextOptions {
  /** custom-elements.json contents, alone or with the path they came from. */
  manifests? : (object | { manifest: object; source?: string | null })[];
  /** the registry: name -> tag name, { tag, args, props, location } or { component }. */
  tags?      : Record<string, unknown>;
  /** some defines could not be read: unknown shorthands are warnings. */
  partial?   : boolean;
}

export interface Item { label: string; kind: string; detail?: string; documentation?: string; insertText?: string; sort?: string }

export declare function scan (statics: Static[], holes?: Range[]): Template;
export declare function createContext (options?: ContextOptions): Context;
export declare function analyze (template: Template, context: Context): Diagnostic[];
export declare function complete (template: Template, offset: number, context: Context): (Range & { items: Item[] }) | null;
export declare function hover (template: Template, offset: number, context: Context): (Range & { markdown: string }) | null;
export declare function definition (template: Template, offset: number, context: Context): (Range & ({ location: { file: string; start: number; end: number } } | { module: string; source: string | null })) | null;

/** What a hole should hold, for a host with a type checker. */
export declare function expectationOf (hole: Hole, context: Context): { kind: 'function' | 'object' | 'function-or-object' | 'tag' } | { kind: 'values'; values: string[] } | null;

export declare function readManifest (manifest: object, source?: string | null, into?: Map<string, ElementInfo>): Map<string, ElementInfo>;
export declare function regionAt (template: Template, offset: number): Region | null;
export declare function elementsOf (nodes: Node[]): Generator<Element>;
export declare function keyOf (name: string): string;
export declare function valuesFor (info: ElementInfo, name: string): string[] | null;
export declare function valuesOf (type: string | { text?: string } | undefined): string[] | null;
export declare const VOID: Set<string>;
