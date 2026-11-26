'use client'
import RevuePaletteFields from './RevuePaletteFields'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import { destroyRevueAction, updateRevueAction } from '@/services/revue/actions'
import type { AppHref } from '@/lib/sites/href'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'

type PropTypes = {
    revue: { id: number, year: number, name: string } & RevuePalette,
    capabilities: CapabilitiesJsObject<'canUpdate' | 'canDestroy'>,
    closePopUpOnSuccess?: string,
    /** Where to go once the revue's year is changed, as its year is its address. Otherwise the page reads again. */
    hrefOfUpdated?: (revue: { year: number }) => AppHref,
    /** Where to go once the revue is gone. Left out, the page stays and reads again. */
    hrefAfterDestroy?: AppHref,
}

/** A revue's year, name and colours to change, and the revue to delete. */
export default function RevueMetaForms({
    revue,
    capabilities,
    closePopUpOnSuccess,
    hrefOfUpdated,
    hrefAfterDestroy,
}: PropTypes) {
    const params = { params: { revueId: revue.id } }

    return <div className="flex flex-col gap-8 min-w-[min(24rem,80vw)]">
        {capabilities.canUpdate.authorized && <Form
            title="Innstillinger"
            action={configureAction(updateRevueAction, params)}
            submitText="Lagre"
            closePopUpOnSuccess={closePopUpOnSuccess}
            // The layout holds the revue's theme and stays on a push to the same year, so only a refresh repaints it.
            refreshOnSuccess
            navigateOnSuccess={hrefOfUpdated && (
                (updated: { year: number }) => (updated.year === revue.year ? null : hrefOfUpdated(updated))
            )}
        >
            <NumberInput name="year" label="År" defaultValue={revue.year} />
            <TextInput name="name" label="Navn" defaultValue={revue.name} />
            <RevuePaletteFields defaultPalette={revue} />
        </Form>}
        {capabilities.canDestroy.authorized && <Form
            action={configureAction(destroyRevueAction, params)}
            submitText="Slett revy"
            submitColor="error"
            closePopUpOnSuccess={closePopUpOnSuccess}
            refreshOnSuccess={!hrefAfterDestroy}
            navigateOnSuccess={hrefAfterDestroy}
            confirmation={{
                confirm: true,
                text: `Vil du slette ${revue.name}? Gruppene og medlemmene deres blir som de er.`,
            }}
        />}
    </div>
}
