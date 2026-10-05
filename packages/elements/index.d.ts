// @htx/elements - type declarations

export interface LoadOptions {
  /** the module the compiled file takes `html` from. default '@htx/js'. */
  adapter?: string;
  /** what a relative url is read against. default document.baseURI. */
  base?: string;
}

/** the module of an .htx file: its component as default export, `style` if it has one. */
export declare function load (url: string, options?: LoadOptions): Promise<{ default: (props: object) => unknown; style?: string }>;

/** <htx-part src as>: replaces itself with the rendered file. */
export declare class HtxPart extends HTMLElement {
  /** the nodes it was replaced with, once they are in the page. */
  ready?: Promise<Node[]>;
}

/** resolves once no <htx-part> below root is left to load, nested ones included. */
export declare function settled (root?: ParentNode): Promise<void>;
