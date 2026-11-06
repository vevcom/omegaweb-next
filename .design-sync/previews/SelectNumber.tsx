import { SelectNumber } from '@ohma/ui'

export const Default = () => (
    <div style={{ maxWidth: '22rem' }}>
        <SelectNumber
            name="admissionYear"
            label="Opptaksår"
            defaultValue={2022}
            options={[
                { value: 2020, key: '2020' },
                { value: 2021, key: '2021' },
                { value: 2022, key: '2022' },
                { value: 2023, key: '2023' },
            ]}
        />
    </div>
)

export const WithLabels = () => (
    <div style={{ maxWidth: '22rem' }}>
        <SelectNumber
            name="guests"
            label="Antall følge"
            defaultValue={1}
            color="primary"
            options={[
                { value: 0, label: 'Ingen', key: 'none' },
                { value: 1, label: 'Én', key: 'one' },
                { value: 2, label: 'To', key: 'two' },
            ]}
        />
    </div>
)

export const OnRaisedSurface = () => (
    <div style={{
        background: 'var(--color-base-200)',
        padding: '1.5rem',
        borderRadius: 'var(--rounding)',
        maxWidth: '22rem',
    }}>
        <SelectNumber
            name="issueNumber"
            label="Utgavenummer"
            background="base100"
            defaultValue={3}
            options={[{ value: 1, key: '1' }, { value: 2, key: '2' }, { value: 3, key: '3' }]}
        />
    </div>
)
