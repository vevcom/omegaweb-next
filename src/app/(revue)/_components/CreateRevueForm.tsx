'use client'
import Form from '@/components/Form/Form'
import NumberInput from '@/components/UI/NumberInput'
import TextInput from '@/components/UI/TextInput'
import { createRevueAction } from '@/services/revue/actions'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = {
    closePopUpOnSuccess?: string,
    /** Where to go once the revue is made. Left out, the page stays and reads its revues again. */
    hrefOfCreated?: (revue: { year: number }) => AppHref,
}

export default function CreateRevueForm({ closePopUpOnSuccess, hrefOfCreated }: PropTypes) {
    return <Form
        title="Ny revy"
        action={createRevueAction}
        submitText="Legg til"
        closePopUpOnSuccess={closePopUpOnSuccess}
        refreshOnSuccess={!hrefOfCreated}
        navigateOnSuccess={hrefOfCreated}
    >
        <NumberInput name="year" label="År" defaultValue={new Date().getUTCFullYear()} />
        <TextInput name="name" label="Navn" />
    </Form>
}
