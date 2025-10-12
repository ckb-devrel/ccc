/**
 * Error types for the render system
 */

export class RenderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export class TraitParseError extends RenderError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "TRAIT_PARSE_ERROR", context);
    this.name = "TraitParseError";
  }
}

export class StyleParseError extends RenderError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "STYLE_PARSE_ERROR", context);
    this.name = "StyleParseError";
  }
}

export class RenderEngineError extends RenderError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "RENDER_ENGINE_ERROR", context);
    this.name = "RenderEngineError";
  }
}

export class ValidationError extends RenderError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "ValidationError";
  }
}
