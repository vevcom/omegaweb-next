'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createArticleCategoryAction } from '@/services/articleCategories/actions'
import useSiteRouter from '@/hooks/useSiteRouter'

export default function AddCategory() {
    const { refresh } = useSiteRouter()

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
                <VisibilityMatrixEditor name="visibilityAdminRequirements" verb="kan redigere artiklene" />
                <h3>Hvem kan lese artiklene?</h3>
                <VisibilityMatrixEditor name="visibilityRegularRequirements" verb="kan lese artiklene" everyone="Alle" />
            </div>
        </Form>
    )
}
