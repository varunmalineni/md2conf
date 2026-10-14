// Port of md2conf/coalesce.py from hunyadi/md2conf (MIT; see NOTICE.md).
//
// `coalesce_json` arrives with the module that needs it; the scanner only uses
// `coalesce_dataclass`.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T extends object>(source: T): T {
  // A spread would drop the prototype, and with it every method (`getImageAlignment`),
  // so the copy is built on the class of `source` as `dataclasses.replace` is.
  const fields = Object.create(Object.getPrototypeOf(source) as object) as Record<string, unknown>;
  return Object.assign(fields, source);
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
  const result = clone(target);
  const fields = result as Record<string, unknown>;
  const sourceFields = source as Record<string, unknown>;

  for (const [name, targetField] of Object.entries(fields)) {
    const sourceField = sourceFields[name];

    if (targetField === undefined || targetField === null) {
      if (sourceField !== undefined && sourceField !== null) {
        fields[name] = sourceField;
      }
    } else if (isRecord(targetField) && isRecord(sourceField)) {
      fields[name] = coalesceDataclass(targetField, sourceField);
    }
  }

  return result;
}
