import { mentionBefore, mentionsOf, stillMentioned } from '@/lib/chatSession/mentions'
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

    test('is none in the middle of a word, after a space, or before the at sign', () => {
        expect(mentionBefore('kari@veven', 10)).toBeNull()
        expect(mentionBefore('Hei @Kari her', 13)).toBeNull()
        expect(mentionBefore('Hei @Kari', 3)).toBeNull()
    })
})
