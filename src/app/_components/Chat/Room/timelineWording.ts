import type { TimelineLine, TimelineNote } from '@/lib/chatSession/timeline'

const notShown = 'som ikke vises her'

const wordings: Record<Exclude<TimelineNote, 'NAMED' | 'INVITED' | 'TAKEN_OUT' | 'BANNED'>, string> = {
    LOCATION: `delte en posisjon, ${notShown}`,
    STICKER: `sendte et klistremerke, ${notShown}`,
    REMOVED: 'sendte en melding som er fjernet',
    ENCRYPTED: 'sendte en melding som ikke kan leses i denne nettleseren',
    OTHER: `sendte noe ${notShown}`,
    CREATED: 'opprettet rommet',
    JOINED: 'ble med',
    LEFT: 'forlot rommet',
    SETTINGS: 'endret innstillingene til rommet',
}

/** What a message says to one who is read it: who wrote, the file it is where it is one, and its text. */
export function wordingOfMessage(
    { senderId, senderName, text, file }: TimelineLine & { kind: 'MESSAGE' },
    nameOf: (person: { id: string, name: string }) => string,
): string {
    const sender = nameOf({ id: senderId, name: senderName })
    if (!file) return `${sender}: ${text}`
    return `${sender} sendte ${file.isPicture ? 'et bilde' : 'en fil'}, ${file.name}${text && `: ${text}`}`
}

/** How large a file is, in the unit that says it shortest. */
export function wordingOfSize(bytes: number): string {
    const units = ['B', 'kB', 'MB', 'GB', 'TB']
    const unit = Math.min(units.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)))
    const inUnit = bytes / 1024 ** unit
    const digits = new Intl.NumberFormat('nb', { maximumFractionDigits: inUnit < 10 && unit > 0 ? 1 : 0 })
    return `${digits.format(inUnit)} ${units[unit]}`
}

/** What is said of a file that is larger than the homeserver takes, with how much it takes where that is known. */
export function wordingOfTooLarge(limit: number | null): string {
    return limit === null
        ? 'Filen er for stor for chatten.'
        : `Filen er for stor. Chatten tar imot filer på opptil ${wordingOfSize(limit)}.`
}

/** What a note of a timeline says, with the names its people are shown by. */
export function wordingOfNote(
    line: TimelineLine & { kind: 'NOTE' },
    nameOf: (person: { id: string, name: string }) => string,
): string {
    const sender = nameOf({ id: line.senderId, name: line.senderName })
    const about = line.about ? nameOf(line.about) : 'noen'
    switch (line.what) {
        case 'NAMED':
            return line.roomName ? `${sender} ga rommet navnet ${line.roomName}` : `${sender} tok bort navnet på rommet`
        case 'INVITED':
            return `${sender} inviterte ${about}`
        case 'TAKEN_OUT':
            return `${sender} tok ${about} ut av rommet`
        case 'BANNED':
            return `${sender} utestengte ${about}`
        default:
            return `${sender} ${wordings[line.what]}`
    }
}
