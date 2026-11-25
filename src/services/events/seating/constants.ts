import type { SeatingPoints } from './plan'

/** How near two guests at a table sit, the nearest first. */
export const NEARNESSES = ['beside', 'across', 'diagonal', 'table'] as const

export const MAX_WISHES = 3
export const MAX_TABLES = 200
export const MAX_SEATS_PER_TABLE = 100

export const DEFAULT_SEATING_POINTS: SeatingPoints = {
    // The first wish a guest gets is worth the most, so everyone getting one beats a few getting all three.
    wishes: [20, 4, 2],
    mutual: 2,
    nearness: { beside: 100, across: 100, diagonal: 75, table: 20 },
    // Lower than a first wish, so a committee is split rather than leaving someone with none of their wishes.
    committeeSplit: 5,
    emptySeat: 1,
}
