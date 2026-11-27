import { createFormStore } from '@/components/Form/Declared/formStore'
import { describe, expect, jest, test } from '@jest/globals'

const nothingRefused = () => []

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
