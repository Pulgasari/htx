// @htx/compiler - type declarations

export interface CompileOptions {
  /** the module the compiled file imports `html` from. default '@htx/preact'. */
  adapter?: string;
  /** the file's path: names the component and goes into error messages. default 'component.htx'. */
  filename?: string;
}

export interface CompileResult {
  /** the es module: `style` if the file has a <style>, the component as default export. */
  code: string;
}

/** a SyntaxError from compile() carries where it happened, 1-based. */
export interface CompileError extends SyntaxError {
  filename: string;
  line: number;
  column: number;
}

/** compiles the source of an .htx file into the source of an es module. */
export declare function compile (source: string, options?: CompileOptions): CompileResult;

export default compile;
