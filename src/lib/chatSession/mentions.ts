import type { Mentions, Person } from './timeline'

/** What a mention of the whole room is written as, which is how every chat client writes it. */
export const ROOM_MENTION = '@room'

const LETTER = '[\\p{L}\\p{N}_]'

/**
 * Whom a text mentions: those of the picked whose mention still stands in it, and the whole room
 * where that is written out apart from their mentions, so one whose name begins so mentions no
 * room. Nobody is mentioned by a name that is only written, since two may have one name, so one
 * whose mention was deleted is to be forgotten, see stillMentioned.
 */
export function mentionsOf(text: string, picked: readonly Person[]): Mentions {
    const { standing, rest } = mentionsIn(text, picked)
    return {
        userIds: standing.map(person => person.id),
        room: new RegExp(`(^|\\s)${ROOM_MENTION}(?!\\w)`).test(rest),
    }
}

/**
 * Those of the picked whose mention, an at sign and their name to its end, stands in the text.
 * Each takes one mention out of what the others are looked for in, the longest names first. So a
 * name that another begins with is not mentioned by that other's mention, and two with one name
 * are both mentioned where it stands twice.
 */
export function stillMentioned(text: string, picked: readonly Person[]): Person[] {
    return mentionsIn(text, picked).standing
}

/**
 * The text with a mention written in place of the one being written, the whole word of it, also
 * what stands after where the text is written. `caret` is where the text is written from then.
 */
export function withMention(text: string, start: number, caret: number, mention: string): { text: string, caret: number } {
    const after = text.slice(caret).replace(new RegExp(`^${LETTER}*`, 'u'), '')
    const written = `${mention}${after === '' || new RegExp(`^(?:${LETTER}|@)`, 'u').test(after) ? ' ' : ''}`
    return { text: `${text.slice(0, start)}${written}${after}`, caret: start + written.length }
}

/** The mention that is being written where the text is written: an at sign after a space, and what follows it. */
export function mentionBefore(text: string, caret: number): { start: number, query: string } | null {
    const written = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
    return written ? { start: caret - written[1].length - 1, query: written[1] } : null
}

function mentionsIn(text: string, picked: readonly Person[]): { standing: Person[], rest: string } {
    const each = picked.filter((person, index) => picked.findIndex(({ id }) => id === person.id) === index)
    const longestFirst = each.toSorted((one, other) => other.name.length - one.name.length)
    const { rest, found } = longestFirst.reduce((before, person) => {
        const written = `@${person.name}`
        const at = placesOf(before.rest, written).find(place => (
            !new RegExp(`^${LETTER}`, 'u').test(before.rest.slice(place + written.length))
        ))
        return at === undefined ? before : {
            rest: `${before.rest.slice(0, at)} ${before.rest.slice(at + written.length)}`,
            found: [...before.found, person],
        }
    }, { rest: text, found: [] as Person[] })
    return { standing: each.filter(person => found.includes(person)), rest }
}

function placesOf(text: string, written: string): number[] {
    const places: number[] = []
    for (let at = text.indexOf(written); at !== -1; at = text.indexOf(written, at + 1)) places.push(at)
    return places
}
