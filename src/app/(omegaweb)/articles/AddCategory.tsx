'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createArticleCategoryAction } from '@/services/articleCategories/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function AddCategory() {
    const { refresh } = useRouter()
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
            <div className="
                grid gap-x-4 gap-y-2
                mobile:grid-cols-2
            ">
                <div className="flex flex-col gap-2">
                    <h3>Hvem kan redigere artiklene?</h3>
                    <VisibilityMatrixEditor
                        requirements={adminRequirements}
                        onChange={setAdminRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityAdminRequirements"
                        value={JSON.stringify(adminRequirements)}
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <h3>Hvem kan lese artiklene? (tomt betyr alle)</h3>
                    <VisibilityMatrixEditor
                        requirements={regularRequirements}
                        onChange={setRegularRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityRegularRequirements"
                        value={JSON.stringify(regularRequirements)}
                    />
                </div>
            </div>
        </Form>
    )
}
