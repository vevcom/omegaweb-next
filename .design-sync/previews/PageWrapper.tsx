import { PageWrapper, Button, SimpleTable, AddHeaderItemPopUp, TextInput } from '@ohma/ui'

export const Default = () => (
    <PageWrapper title="Arrangementer">
        <p style={{ color: 'var(--text-muted)' }}>
            Alt som skjer i Omega, samlet på ett sted.
        </p>
    </PageWrapper>
)

export const WithHeaderItem = () => (
    <PageWrapper
        title="Komitéer"
        headerItem={
            <AddHeaderItemPopUp popUpKey="pw-add-committee">
                <div style={{ display: 'grid', gap: '1rem', minWidth: '16rem' }}>
                    <h2 style={{ margin: 0 }}>Ny komité</h2>
                    <TextInput name="committeeName" label="Navn" background="base200" />
                    <Button color="primary">Opprett</Button>
                </div>
            </AddHeaderItemPopUp>
        }
    >
        <SimpleTable
            header={['Komité', 'Medlemmer']}
            body={[['Vevkom', '9'], ['Arrkom', '14'], ['Kjellerkom', '11']]}
        />
    </PageWrapper>
)

export const HiddenTitle = () => (
    <PageWrapper title="Forsiden" hideTitle>
        <p style={{ margin: 0 }}>
            Tittelen er skjult i innholdet, men settes fortsatt for navigasjonslinjen.
        </p>
    </PageWrapper>
)
