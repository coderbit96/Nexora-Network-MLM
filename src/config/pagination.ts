/**
 * Offset pagination becomes increasingly expensive at very large offsets.
 * Cursor pagination is preferable for exports; interactive endpoints have a
 * deliberately finite ceiling to keep crafted queries from causing costly
 * database skips.
 */
export const MAX_INTERACTIVE_PAGE = 10_000;
