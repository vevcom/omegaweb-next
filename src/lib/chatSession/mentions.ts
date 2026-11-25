import type { Mentions, Person } from './timeline'

/** What a mention of the whole room is written as, which is how every chat client writes it. */
export const ROOM_MENTION = '@room'

/**
 * Whom a text mentions: those of the picked whose mention still stands in it, and the whole room
 * where that is written out. Nobody is mentioned by a name that is only written, since two may
 * have one name, so one whose mention was deleted is to be forgotten, see stillMentioned.
 */
export function mentionsOf(text: string, picked: readonly Person[]): Mentions {
    return {
        userIds: stillMentioned(text, picked).map(person => person.id),
        room: new RegExp(`(^|\\s)${ROOM_MENTION}(?!\\w)`).test(text),
    }
}

/**
 * Those of the picked whose mention, an at sign and their name, stands in the text. The longest
 * names are looked for first and taken out of what the others are looked for in, so a name that
 * another begins with is not mentioned by that other's mention.
 */
export function stillMentioned(text: string, picked: readonly Person[]): Person[] {
    const longestFirst = picked.toSorted((one, other) => other.name.length - one.name.length)
    const { standing } = longestFirst.reduce(({ rest, standing: found }, person) => {
        const written = `@${person.name}`
        return rest.includes(written)
            ? { rest: rest.split(written).join(' '), standing: [...found, person.id] }
            : { rest, standing: found }
    }, { rest: text, standing: [] as string[] })
    return picked.filter((person, index) => (
        standing.includes(person.id) && picked.findIndex(({ id }) => id === person.id) === index
    ))
}

/** The mention that is being written where the text is written: an at sign after a space, and what follows it. */
export function mentionBefore(text: string, caret: number): { start: number, query: string } | null {
    const written = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
    return written ? { start: caret - written[1].length - 1, query: written[1] } : null
}
