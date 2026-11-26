import type { TimelineLine, TimelineNote } from '@/lib/chatSession/timeline'

const notShown = 'som ikke vises her'

const wordings: Record<Exclude<TimelineNote, 'NAMED' | 'INVITED' | 'TAKEN_OUT' | 'BANNED'>, string> = {
    IMAGE: `sendte et bilde, ${notShown}`,
    FILE: `sendte en fil, ${notShown}`,
    AUDIO: `sendte et lydklipp, ${notShown}`,
    VIDEO: `sendte en video, ${notShown}`,
    LOCATION: `delte en posisjon, ${notShown}`,
    STICKER: `sendte et klistremerke, ${notShown}`,
    REMOVED: 'sendte en melding som er fjernet',
    ENCRYPTED: 'sendte en kryptert melding, som ikke kan leses her',
    OTHER: `sendte noe ${notShown}`,
    CREATED: 'opprettet rommet',
    JOINED: 'ble med',
    LEFT: 'forlot rommet',
    SETTINGS: 'endret innstillingene til rommet',
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
