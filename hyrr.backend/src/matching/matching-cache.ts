import type { MatchTab } from "./dtos/matching-query.dto"

/** Cache key of one seeker's match list (shared by MatchingService and EmbeddingsService). */
export const matchingCacheKey = (userId: string, tab: MatchTab, limit: number) =>
  `matching:${userId}:${tab}:${limit}`

/** Pattern matching every cached match list of a seeker. */
export const matchingCachePattern = (userId: string) => `matching:${userId}:*`
