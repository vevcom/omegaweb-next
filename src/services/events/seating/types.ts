import type { SeatingGuest, SeatingPlan, SeatingWishes } from './plan'

/** The seating of an event as those administrating it work on it. */
export type SeatingBoard = {
    wishesEnd: Date | null,
    publishedAt: Date | null,
    /** The seats of each table, empty until a plan has been saved. */
    seats: number[],
    guests: SeatingGuest[],
    wishes: SeatingWishes,
    plan: SeatingPlan,
    /** The guests kept at their table when a new draft is made. */
    locked: number[],
}

/** The seating of an event as one of its guests sees it. */
export type OwnSeating = {
    wishesEnd: Date | null,
    /** Who can be wished for, the guest left out. */
    options: { id: number, name: string }[],
    wishes: number[],
    /** Null until the plan is published, or when the guest has no table. */
    table: { number: number, guests: string[] } | null,
}
