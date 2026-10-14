// Port of md2conf/coalesce.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// `coalesce_json` arrives with the module that needs it (the publisher); the scanner only
// uses `coalesce_dataclass`.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Upstream recurses into a field whose declared type is a data-class, not into any object. */
function isDataClass(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype !== null && prototype !== Object.prototype;
}

/** `dataclasses.replace` returns an instance of the same class; a spread would drop it. */
function instantiate<T extends object>(source: T): T {
  const fields = Object.create(Object.getPrototypeOf(source) as object) as Record<string, unknown>;
  return Object.assign(fields, source);
}

/** Upstream deep-copies a value taken from the source into a field the target has not set. */
function deepClone(value: unknown): unknown {
  if (!isDataClass(value)) {
    return structuredClone(value);
  }
  const copy: Record<string, unknown> = instantiate(value);
  for (const [name, field] of Object.entries(copy)) {
    copy[name] = deepClone(field);
  }
  return copy;
}

/**
 * Implements nullish coalescing assignment on each field of a data-class.
 *
 * Iterates over each field of the data-class, and evaluates the right operand and assigns it to
 * the left only if the left operand is `None`. Applies recursively when the field is a
 * data-class.
 *
 * @returns A newly created data-class instance.
 */
export function coalesceDataclass<T extends object>(target: T, source: T): T {
  const result = instantiate(target);
  const fields = result as Record<string, unknown>;
  const sourceFields = source as Record<string, unknown>;

  for (const [name, targetField] of Object.entries(fields)) {
    const sourceField = sourceFields[name];

    if (targetField === undefined || targetField === null) {
      if (sourceField !== undefined && sourceField !== null) {
        fields[name] = deepClone(sourceField);
      }
    } else if (isDataClass(targetField) && isDataClass(sourceField)) {
      fields[name] = coalesceDataclass(targetField, sourceField);
    }
  }

  return result;
}
