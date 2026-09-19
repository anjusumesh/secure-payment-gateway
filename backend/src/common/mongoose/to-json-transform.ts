/**
 * Shared Mongoose `toJSON.transform`: replaces `_id` with a string `id` and
 * drops the internal `__v`, so API responses match the shapes documented in
 * specs/api-contract.md instead of leaking Mongoose's raw document fields.
 */
export function toIdJson(_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}
