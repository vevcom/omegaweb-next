import { createFormStore } from '@/components/Form/Declared/formStore'
import { submitterStateOf } from '@/components/Form/Declared/submitterContext'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { FormValues } from '@/components/Form/Declared/formStore'
import type { ErrorMessage } from '@/services/error'

const nothingRefused = () => []

const requiresMarkdown = (values: FormValues) => (
    typeof values.markdown === 'string' ? [] : [{ path: ['markdown'], message: 'Påkrevd' }]
)

describe('the store of a declared form', () => {
    test('submits the values of the mounted fields only', () => {
        const store = createFormStore(nothingRefused)
        store.mount('quote', '')
        store.mount('author', '')
        const unmount = store.mount('gone', '')
        store.setValue('quote', 'Det ordner seg')
        store.setValue('gone', 'ikke med')
        unmount()

        expect(store.startSubmit()).toEqual({ quote: 'Det ordner seg', author: '' })
    })

    test('a field starts as its default value, and as the empty value of its kind without one', () => {
        const store = createFormStore(nothingRefused, { building: 'Realfagbygget', gone: 'ikke med' })
        store.mount('building', '')
        store.mount('floor', undefined)

        expect(store.value('building')).toBe('Realfagbygget')
        expect(store.startSubmit()).toEqual({ building: 'Realfagbygget', floor: undefined })
    })

    test('shows an issue at the field it names, and with the general ones when no mounted field has that name', () => {
        const store = createFormStore(nothingRefused)
        store.mount('quote', '')

        store.refuse([
            { path: ['quote'], message: 'Sitatet kan ikke være tomt' },
            { path: ['author'], message: 'Noen må siteres' },
            { message: 'Du har ikke tilgang' },
        ])

        expect(store.errors('quote').map(issue => issue.message)).toEqual(['Sitatet kan ikke være tomt'])
        expect(store.errors('author')).toEqual([])
        expect(store.generalErrors().map(issue => issue.message)).toEqual(['Noen må siteres', 'Du har ikke tilgang'])
    })

    test('notifies the subscribers of the field whose value is set, and of no other', () => {
        const store = createFormStore(nothingRefused)
        store.mount('quote', '')
        store.mount('author', '')
        const [quote, author, form] = [jest.fn(), jest.fn(), jest.fn()]
        store.subscribeToField('quote', quote)
        store.subscribeToField('author', author)
        store.subscribeToForm(form)

        store.setValue('quote', 'Det ordner seg')

        expect(store.value('quote')).toBe('Det ordner seg')
        expect(quote).toHaveBeenCalledTimes(1)
        expect(author).not.toHaveBeenCalled()
        expect(form).not.toHaveBeenCalled()
    })

    test('checks a field that is left only once its value has been set', () => {
        const store = createFormStore(values => (values.quote === '' ? [{ path: ['quote'], message: 'Tomt' }] : []))
        store.mount('quote', '')

        store.leave('quote')
        expect(store.errors('quote')).toEqual([])

        store.setValue('quote', '')
        store.leave('quote')
        expect(store.errors('quote').map(issue => issue.message)).toEqual(['Tomt'])
    })

    test('starts no second submit while one is under way, or while its success shows', () => {
        const store = createFormStore(nothingRefused)
        store.mount('quote', '')

        expect(store.startSubmit()).toEqual({ quote: '' })
        expect(store.startSubmit()).toBeUndefined()

        store.succeed()
        expect(store.startSubmit()).toBeUndefined()

        store.clearSuccess()
        expect(store.startSubmit()).toEqual({ quote: '' })
    })
})

describe('a form that saves itself', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    test('saves a second after the last change, one save at a time, and then the newest values', async () => {
        const server = answeredByHand()
        const store = createFormStore(nothingRefused, {}, { delayMs: 1000, save: server.save })
        store.mount('markdown', '')

        store.setValue('markdown', 'H')
        await jest.advanceTimersByTimeAsync(500)
        store.setValue('markdown', 'He')
        await jest.advanceTimersByTimeAsync(999)
        expect(server.sent).toEqual([])
        await jest.advanceTimersByTimeAsync(1)
        expect(server.sent).toEqual([{ markdown: 'He' }])
        expect(store.saveStatus()).toBe('saving')

        store.setValue('markdown', 'Hei')
        await jest.advanceTimersByTimeAsync(1000)
        store.setValue('markdown', 'Hei!')
        store.leave('markdown')
        expect(server.sent).toEqual([{ markdown: 'He' }])

        await server.answer([])
        expect(server.sent).toEqual([{ markdown: 'He' }, { markdown: 'Hei!' }])
        expect(store.saveStatus()).toBe('saving')
        await server.answer([])
        expect(store.saveStatus()).toBe('saved')
        await jest.advanceTimersByTimeAsync(5000)
        expect(server.sent).toHaveLength(2)
    })

    test('an answer to a save of older values does not speak for newer ones', async () => {
        const server = answeredByHand()
        const store = createFormStore(nothingRefused, {}, { delayMs: 1000, save: server.save })
        store.mount('markdown', '')

        store.setValue('markdown', 'gammel')
        store.leave('markdown')
        store.setValue('markdown', 'ny')
        await server.answer([{ path: ['markdown'], message: 'For lang' }])

        expect(store.saveStatus()).toBe('unsaved')
        expect(store.errors('markdown')).toEqual([])

        await jest.advanceTimersByTimeAsync(1000)
        expect(server.sent).toEqual([{ markdown: 'gammel' }, { markdown: 'ny' }])
        await server.answer([])
        expect(store.saveStatus()).toBe('saved')
    })

    test('a failed save stays unsaved until the next change or leave, which try again', async () => {
        const server = answeredByHand()
        const store = createFormStore(nothingRefused, {}, { delayMs: 1000, save: server.save })
        store.mount('markdown', '')

        store.setValue('markdown', 'tekst')
        store.leave('markdown')
        await server.answer([{ message: 'Avsnittet blir for stort.' }])
        expect(store.saveStatus()).toBe('failed')
        expect(store.generalErrors().map(issue => issue.message)).toEqual(['Avsnittet blir for stort.'])

        await jest.advanceTimersByTimeAsync(60_000)
        expect(server.sent).toHaveLength(1)

        store.leave('markdown')
        expect(server.sent).toHaveLength(2)
        await server.answer([{ message: 'Avsnittet blir for stort.' }])
        expect(store.saveStatus()).toBe('failed')

        store.setValue('markdown', 'kortere')
        expect(store.saveStatus()).toBe('unsaved')
        await jest.advanceTimersByTimeAsync(1000)
        expect(server.sent.at(-1)).toEqual({ markdown: 'kortere' })
        await server.answer([])
        expect(store.saveStatus()).toBe('saved')
        expect(store.generalErrors()).toEqual([])
    })

    test('a change made while a save is under way is sent when the form is taken away before it answers', async () => {
        const server = answeredByHand()
        const store = createFormStore(requiresMarkdown, {}, { delayMs: 1000, save: server.save })
        const unmountField = store.mount('markdown', '')

        store.setValue('markdown', 'A')
        await jest.advanceTimersByTimeAsync(1000)
        store.setValue('markdown', 'AB')
        // React cleans up the submitter before the fields inside it.
        void store.saveUnsaved()
        unmountField()
        await server.answer([])

        expect(server.sent).toEqual([{ markdown: 'A' }, { markdown: 'AB' }])
        await server.answer([])
        expect(store.saveStatus()).toBe('saved')
    })

    test('a value given by a reader is read when it is saved, and not as it changes', async () => {
        const server = answeredByHand()
        const store = createFormStore(requiresMarkdown, {}, { delayMs: 1000, save: server.save })
        const unmountField = store.mount('markdown', '')
        let typed = 'A'
        const read = jest.fn(() => typed)

        store.setReader('markdown', read)
        typed = 'AB'
        store.setReader('markdown', read)
        expect(read).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1000)
        expect(server.sent).toEqual([{ markdown: 'AB' }])

        typed = 'ABC'
        store.setReader('markdown', read)
        void store.saveUnsaved()
        unmountField()
        typed = 'what a destroyed editor reads'
        await server.answer([])
        expect(server.sent).toEqual([{ markdown: 'AB' }, { markdown: 'ABC' }])
    })

    test('a save that rejects does not keep the form from saving again', async () => {
        const sent: FormValues[] = []
        const store = createFormStore(requiresMarkdown, {}, {
            delayMs: 1000,
            save: values => {
                sent.push(values)
                return sent.length === 1 ? Promise.reject(new Error('Nettverket svarte ikke')) : Promise.resolve([])
            },
        })
        store.mount('markdown', '')

        store.setValue('markdown', 'første')
        await expect(store.saveUnsaved()).rejects.toThrow('Nettverket svarte ikke')
        store.setValue('markdown', 'andre')
        await jest.advanceTimersByTimeAsync(1000)

        expect(sent).toEqual([{ markdown: 'første' }, { markdown: 'andre' }])
        expect(store.saveStatus()).toBe('saved')
    })

    test('values the schema refuses are not sent, and the save has failed', async () => {
        const server = answeredByHand()
        const tooLong = (values: FormValues) => (
            values.markdown === 'for lang' ? [{ path: ['markdown'], message: 'For lang' }] : []
        )
        const store = createFormStore(tooLong, {}, { delayMs: 1000, save: server.save })
        store.mount('markdown', '')

        store.setValue('markdown', 'for lang')
        await jest.advanceTimersByTimeAsync(1000)

        expect(server.sent).toEqual([])
        expect(store.saveStatus()).toBe('failed')
        expect(store.errors('markdown').map(issue => issue.message)).toEqual(['For lang'])
    })

    test('what its parts are handed is the state of the save, and nothing of the values', () => {
        const store = createFormStore(nothingRefused, { markdown: 'hemmelig' })
        store.mount('markdown', '')

        const handed = submitterStateOf(store)

        expect(Object.keys(handed).sort()).toEqual(['saveStatus', 'subscribe'])
        expect(handed.saveStatus()).toBe('untouched')
    })
})

/** A save whose answers are given by the test, in the order the saves were sent. */
function answeredByHand() {
    const sent: FormValues[] = []
    const waiting: ((issues: ErrorMessage[]) => void)[] = []
    return {
        sent,
        save: (values: FormValues) => {
            sent.push(values)
            return new Promise<ErrorMessage[]>(resolve => waiting.push(resolve))
        },
        answer: async (issues: ErrorMessage[]) => {
            waiting.shift()?.(issues)
            await jest.advanceTimersByTimeAsync(0)
        },
    }
}
