/**
 * @timezone Europe/Oslo
 *
 * Oslo is an hour ahead of UTC in winter, so the first half hour of a day there is the day before in UTC.
 */
import { dateFromUtcInputValue, dateOfInputValue, utcInputValue } from '@/lib/dates/dateInputValue'
import { beforeAll, describe, expect, jest, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PropTypes as SelectPropTypes } from '@/components/UI/Select'

let mockSelect: SelectPropTypes<string> | undefined

// The input's own change event needs a DOM, so the select is replaced by one that hands over its props. The kinds
// are imported after it, since an import at the top is run before it.
jest.mock('../../../src/app/_components/UI/Select', () => ({
    SelectString: (props: SelectPropTypes<string>) => {
        mockSelect = props
        return null
    },
}))
const loadingKinds = import('@/components/Form/Declared/Kinds/kinds')
let kinds: Awaited<typeof loadingKinds>['kinds']

beforeAll(async () => {
    kinds = (await loadingKinds).kinds
})

describe('the date kind', () => {
    const halfPastMidnightInOslo = new Date('2026-02-28T23:30:00.000Z')
    const midnightInUtc = new Date('2026-03-01T00:00:00.000Z')

    test('shows a date in the browser\'s zone, as a date input in a FormData form does', () => {
        expect(renderedDate(halfPastMidnightInOslo, true)).toContain('value="2026-03-01T00:30"')
        expect(renderedDate(midnightInUtc, false)).toContain('value="2026-03-01"')
        expect(renderedDate(undefined, true)).not.toContain('value=')
    })

    test('writes what the server stores today of the same pick in a FormData form, and so what it shows', () => {
        expect(dateOfInputValue('2026-03-01T00:30')).toEqual(storedToday('2026-03-01T00:30', true))
        expect(dateOfInputValue('2026-03-01')).toEqual(storedToday('2026-03-01', false))
        expect(dateOfInputValue('2026-03-01T00:30')).toEqual(halfPastMidnightInOslo)
        expect(dateOfInputValue('2026-03-01')).toEqual(midnightInUtc)
        expect(dateOfInputValue('')).toBeUndefined()
    })
})

describe('the boolean kind', () => {
    test('is checked by true and by nothing else', () => {
        expect(renderedBoolean(true)).toContain('checked=""')
        expect(renderedBoolean(false)).not.toContain('checked=""')
        expect(renderedBoolean(undefined)).not.toContain('checked=""')
    })
})

describe('the select kind', () => {
    const options = [
        { value: null, label: 'Ingen' },
        { value: 7, label: 'Bedpres' },
        { value: 9, label: 'Kurs' },
    ]

    test('selects the option of its value, and none for no value', () => {
        expect(selectedPosition(9)).toBe('2')
        expect(selectedPosition(null)).toBe('0')
        expect(selectedPosition(undefined)).toBe('-1')
        expect(mockSelect?.options.map(option => option.label)).toEqual(['Ingen', 'Bedpres', 'Kurs'])
    })

    test('writes the value of the option picked, also none', () => {
        const set = jest.fn<(value: number | string | null | undefined) => void>()
        renderSelect(9, set)

        mockSelect?.onChange?.('1')
        mockSelect?.onChange?.('0')
        expect(set.mock.calls).toEqual([[7], [null]])
    })

    function selectedPosition(value: unknown) {
        renderSelect(value, jest.fn())
        return mockSelect?.value
    }

    function renderSelect(value: unknown, set: (value: number | string | null | undefined) => void) {
        renderToStaticMarkup(
            <kinds.select.Component label="Bedriftspresentasjon" field={binding(value, set)} options={options} />
        )
    }
})

/** What a date input in a FormData form posts of a pick, read as the server reads it in UTC. */
function storedToday(picked: string, includeTime: boolean) {
    return dateFromUtcInputValue(utcInputValue(new Date(picked), includeTime))
}

function renderedDate(value: Date | undefined, includeTime: boolean) {
    return renderToStaticMarkup(
        <kinds.date.Component label="Start" field={binding(value, jest.fn())} includeTime={includeTime} />
    )
}

function renderedBoolean(value: boolean | undefined) {
    return renderToStaticMarkup(<kinds.boolean.Component label="Kopier" field={binding(value, jest.fn())} />)
}

function binding<Writes>(value: unknown, set: (value: Writes | undefined) => void) {
    return { name: 'field', value, set, setReader: jest.fn(), leave: jest.fn() }
}
