import { mentionBefore, mentionsOf, stillMentioned, withMention } from '@/lib/chatSession/mentions'
import { describe, expect, test } from '@jest/globals'

const ola = { id: '@ola:chat.test', name: 'Ola Nord' }
const olaTheLonger = { id: '@olan:chat.test', name: 'Ola Nordmann' }
const kari = { id: '@kari:chat.test', name: 'Kari Nordmann' }

describe('whom a text mentions', () => {
    test('is those of the picked whose mention stands in it, once each, and nobody whose name is only written', () => {
        expect(mentionsOf('Hei @Kari Nordmann og Ola Nord, og @Kari Nordmann igjen', [kari, ola, kari]))
            .toEqual({ userIds: [kari.id], room: false })
        expect(mentionsOf('Hei Kari Nordmann', [])).toEqual({ userIds: [], room: false })
    })

    test('is not one whose name another\'s begins with, by that other\'s mention', () => {
        expect(stillMentioned('Hei @Ola Nordmann', [ola, olaTheLonger])).toEqual([olaTheLonger])
        expect(stillMentioned('Hei @Ola Nordmann og @Ola Nord', [ola, olaTheLonger])).toEqual([ola, olaTheLonger])
        expect(stillMentioned('Hei @Ola Nord', [ola, olaTheLonger])).toEqual([ola])
    })

    test('is one whose mention ends where their name does, whatever sign follows it', () => {
        expect(stillMentioned('Hei @Ola Nordmann', [ola])).toEqual([])
        expect(stillMentioned('Hei @Ola Nordø', [ola])).toEqual([])
        expect(stillMentioned('Hei @Ola Nord, @Ola Nord. Og (@Ola Nord)', [ola])).toEqual([ola])
        expect(stillMentioned('Hei @Ola Nordmann og @Ola Nord!', [ola])).toEqual([ola])
    })

    test('is each of two with one name where it stands twice, and one of them where it stands once', () => {
        const otherOla = { id: '@ola2:chat.test', name: 'Ola Nord' }
        expect(stillMentioned('@Ola Nord og @Ola Nord', [ola, otherOla])).toEqual([ola, otherOla])
        expect(stillMentioned('@Ola Nord', [ola, otherOla])).toEqual([ola])
    })

    test('is not the whole room by the mention of one whose name begins as the room\'s mention', () => {
        const service = { id: '@service:chat.test', name: 'room Service' }
        expect(mentionsOf('Hei @room Service', [service])).toEqual({ userIds: [service.id], room: false })
        expect(mentionsOf('Hei @room Service og @room', [service])).toEqual({ userIds: [service.id], room: true })
        expect(mentionsOf('Hei @room Service', []).room).toBe(true)
    })

    test('is the whole room where that is written out as a word of its own', () => {
        expect(mentionsOf('Hei @room!', []).room).toBe(true)
        expect(mentionsOf('@room', []).room).toBe(true)
        expect(mentionsOf('Hei @roommate og x@room', []).room).toBe(false)
    })
})

describe('the mention that is being written', () => {
    test('is an at sign after a space or first in the text, with what follows it up to where the text is written', () => {
        expect(mentionBefore('Hei @Ka', 7)).toEqual({ start: 4, query: 'Ka' })
        expect(mentionBefore('@', 1)).toEqual({ start: 0, query: '' })
        expect(mentionBefore('Hei @Kari her', 9)).toEqual({ start: 4, query: 'Kari' })
    })

    test('is replaced whole by the one who is picked, also what of it stands after where the text is written', () => {
        expect(withMention('Hei @Ka', 4, 7, '@Kari Nordmann')).toEqual({ text: 'Hei @Kari Nordmann ', caret: 19 })
        expect(withMention('@Kari, hei', 0, 3, '@Kari Nordmann')).toEqual({ text: '@Kari Nordmann, hei', caret: 14 })
        expect(withMention('@Ka hei', 0, 3, '@Kari')).toEqual({ text: '@Kari hei', caret: 5 })
        expect(withMention('@@ola', 0, 1, '@Kari')).toEqual({ text: '@Kari @ola', caret: 6 })
    })

    test('is none in the middle of a word, after a space, or before the at sign', () => {
        expect(mentionBefore('kari@veven', 10)).toBeNull()
        expect(mentionBefore('Hei @Kari her', 13)).toBeNull()
        expect(mentionBefore('Hei @Kari', 3)).toBeNull()
    })
})
