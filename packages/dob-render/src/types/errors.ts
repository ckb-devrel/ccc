// Custom error types for the dob-render package

export class RenderError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RenderError";

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RenderError);
    }
  }
}

export class SvgParseError extends RenderError {
  constructor(
    message: string,
    public readonly svgContent?: string,
    cause?: Error,
  ) {
    super(message, cause, { svgContent });
    this.name = "SvgParseError";
  }
}

export class SvgResolveError extends RenderError {
  constructor(
    message: string,
    public readonly svgContent?: string,
    public readonly nodeHref?: string,
    cause?: Error,
  ) {
    super(message, cause, { svgContent, nodeHref });
    this.name = "SvgResolveError";
  }
}

export class StyleParseError extends RenderError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message, cause, context);
    this.name = "StyleParseError";
  }
}

export class ValidationError extends RenderError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message, cause, context);
    this.name = "ValidationError";
  }
}

export class RenderEngineError extends RenderError {
  constructor(
    message: string,
    public readonly renderType?: string,
    public readonly renderData?: unknown,
    cause?: Error,
  ) {
    super(message, cause, { renderType, renderData });
    this.name = "RenderEngineError";
  }
}
