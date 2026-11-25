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
    /** The guests kept in their seat when a new draft is made. */
    locked: number[],
    /** The id of the newest table, so a save from a board someone else has since saved is refused. */
    version: number,
}

/** The seating of an event as one of its guests sees it. */
export type OwnSeating = {
    wishesEnd: Date | null,
    /** Who can be wished for, the guest left out. */
    options: { id: number, name: string }[],
    wishes: number[],
    published: boolean,
    /** Null until the plan is published, or when the guest has no seat. Each seat holds a name, or null when empty. */
    table: { number: number, seats: (string | null)[], ownSeat: number } | null,
}
