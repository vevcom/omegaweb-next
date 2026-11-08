import { Textarea } from '@ohma/ui'

export const Default = () => (
    <Textarea
        name="motivation"
        label="Motivasjon"
        rows={5}
        defaultValue={'Jeg ønsker å bli med i Vevkom fordi jeg vil lære mer om webutvikling '
            + 'og bidra til å videreutvikle Omegas nettsider.'}
    />
)

export const Empty = () => (
    <Textarea name="comment" label="Kommentar" rows={4} placeholder="Skriv en kommentar…" />
)

export const OnRaisedSurface = () => (
    <div style={{ background: 'var(--color-base-200)', padding: '1.5rem', borderRadius: 'var(--rounding)' }}>
        <Textarea
            name="quote"
            label="Sitat"
            background="raised"
            rows={3}
            defaultValue="Det var en gang en broder som glemte hvor kjelleren var."
        />
    </div>
)
