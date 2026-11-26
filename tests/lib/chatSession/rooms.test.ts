import { nameOfMembers } from '@/lib/chatSession/rooms'
import { describe, expect, test } from '@jest/globals'

describe('the name of a room that has none of its own', () => {
    test('is the other one in it', () => {
        expect(nameOfMembers(['Kari Nordmann'], 1)).toBe('Kari Nordmann')
    })

    test('is the others in it, and how many more they are', () => {
        expect(nameOfMembers(['Kari', 'Ola'], 2)).toBe('Kari og Ola')
        expect(nameOfMembers(['Kari', 'Ola', 'Per'], 3)).toBe('Kari og 2 andre')
        expect(nameOfMembers(['Kari'], 3)).toBe('Kari og 2 andre')
    })

    test('says so when nobody else is in it', () => {
        expect(nameOfMembers([], 0)).toBe('Tomt rom')
    })
})
