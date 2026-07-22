/**
 * Estimate preparation time based on order items.
 *
 * Heuristic: 10-minute base + 2 minutes per item, capped at 45 minutes.
 * Returns a min/max range (±3 minutes around the estimate).
 */
export function estimatePrepTime(
    itemCount: number
): { min: number; max: number; estimated: number } {
    const BASE = 10
    const PER_ITEM = 2
    const MIN_RANGE = 3
    const MAX_CAP = 45

    const estimated = Math.min(BASE + itemCount * PER_ITEM, MAX_CAP)
    const min = Math.max(estimated - MIN_RANGE, BASE)
    const max = estimated + MIN_RANGE

    return { min, max, estimated }
}
