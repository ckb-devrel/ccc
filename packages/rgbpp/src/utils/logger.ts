/**
 * Standard logger interface compatible with console and major logging libraries
 */
export interface Logger {
  log?: (message: string, ...args: unknown[]) => void;
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}
