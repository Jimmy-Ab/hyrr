/** Cursor pagination shared by the admin lists: `{ items, nextCursor }`, cursor = last item id. */

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export const pageSize = (limit?: number) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit || DEFAULT_PAGE_SIZE)))

/** Prisma args: one extra row tells whether a next page exists. */
export function pageArgs(cursor?: string, limit?: number) {
  return {
    take: pageSize(limit) + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }
}

export function pageOf<T extends { id: string }>(rows: T[], limit?: number) {
  const size = pageSize(limit)
  const items = rows.slice(0, size)
  return { items, nextCursor: rows.length > size ? items[items.length - 1].id : null }
}
