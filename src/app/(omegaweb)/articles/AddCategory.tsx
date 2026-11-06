'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createArticleCategoryAction } from '@/services/articleCategories/actions'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function AddCategory() {
    const { refresh } = useSiteRouter()
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [regularRequirements, setRegularRequirements] = useState<VisibilityRequirement[]>([])

    return (
        <Form
            action={createArticleCategoryAction}
            className="min-w-[50vw]"
            successCallback={refresh}
        >
            <TextInput label="Navn" name="name" />
            <Textarea className="min-h-[100px]" label="Beskrivelse" name="description" />
            <div className="flex flex-col gap-[0.5rem]">
                <h3>Hvem kan redigere artiklene?</h3>
                <VisibilityMatrixEditor
                    requirements={adminRequirements}
                    onChange={setAdminRequirements}
                    verb="kan redigere artiklene"
                />
                <input
                    type="hidden"
                    name="visibilityAdminRequirements"
                    value={JSON.stringify(adminRequirements)}
                />
                <h3>Hvem kan lese artiklene?</h3>
                <VisibilityMatrixEditor
                    requirements={regularRequirements}
                    onChange={setRegularRequirements}
                    verb="kan lese artiklene"
                    everyone="Alle"
                />
                <input
                    type="hidden"
                    name="visibilityRegularRequirements"
                    value={JSON.stringify(regularRequirements)}
                />
            </div>
        </Form>
    )
}
