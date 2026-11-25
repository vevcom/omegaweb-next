'use client'
import { articleCategoryVisibility } from './articleCategoryVisibility'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
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
                <h3>{articleCategoryVisibility.admin.heading}</h3>
                <articleCategoryVisibility.admin.Field name="visibilityAdminRequirements" />
                <h3>{articleCategoryVisibility.regular.heading}</h3>
                <articleCategoryVisibility.regular.Field name="visibilityRegularRequirements" />
            </div>
        </Form>
    )
}
