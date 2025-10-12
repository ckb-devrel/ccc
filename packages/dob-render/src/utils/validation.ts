import { ValidationError } from "../types/errors.js";

/**
 * Validation utilities for the render system
 */

export function validateTraitValue(
  value: unknown,
): value is string | number | Date {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    value instanceof Date
  );
}

export function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ValidationError(
      `Expected string for ${fieldName}, got ${typeof value}`,
      {
        fieldName,
        value,
        expectedType: "string",
      },
    );
  }
  return value;
}

export function validateNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || isNaN(value)) {
    throw new ValidationError(
      `Expected number for ${fieldName}, got ${typeof value}`,
      {
        fieldName,
        value,
        expectedType: "number",
      },
    );
  }
  return value;
}

export function validateArray<T>(
  value: unknown,
  fieldName: string,
  itemValidator?: (item: unknown) => item is T,
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(
      `Expected array for ${fieldName}, got ${typeof value}`,
      {
        fieldName,
        value,
        expectedType: "array",
      },
    );
  }

  if (itemValidator) {
    for (let i = 0; i < value.length; i++) {
      if (!itemValidator(value[i])) {
        throw new ValidationError(
          `Invalid item at index ${i} in ${fieldName}`,
          {
            fieldName,
            index: i,
            item: value[i],
          },
        );
      }
    }
  }

  return value as T[];
}

export function validateObject(
  value: unknown,
  fieldName: string,
  requiredKeys: string[],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new ValidationError(
      `Expected object for ${fieldName}, got ${typeof value}`,
      {
        fieldName,
        value,
        expectedType: "object",
      },
    );
  }

  const obj = value as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in obj)) {
      throw new ValidationError(
        `Missing required key '${key}' in ${fieldName}`,
        {
          fieldName,
          missingKey: key,
          availableKeys: Object.keys(obj),
        },
      );
    }
  }

  return obj;
}

export function validateNonEmptyString(
  value: unknown,
  fieldName: string,
): string {
  const str = validateString(value, fieldName);
  if (str.trim().length === 0) {
    throw new ValidationError(`Expected non-empty string for ${fieldName}`, {
      fieldName,
      value: str,
    });
  }
  return str;
}
