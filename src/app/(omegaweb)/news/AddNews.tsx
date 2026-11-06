'use client'
import Textarea from '@/components/UI/Textarea'
import { createNewsAction } from '@/services/news/actions'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { EditModeContext } from '@/contexts/EditMode'
import { formatVevenUri } from '@/lib/urlEncoding'
import useSiteRouter from '@/hooks/useSiteRouter'
import { appHref } from '@/lib/sites/href'
import { useContext } from 'react'
import type { ExpandedNewsArticle } from '@/services/news/types'

export default function AddNews() {
    const { push } = useSiteRouter()
    const editModeCtx = useContext(EditModeContext)

    const handleCreate = (data?: ExpandedNewsArticle) => {
        editModeCtx?.setEditMode(true)
        push(appHref(`/news/${data ? formatVevenUri(data.articleName, data.id) : ''}`))
    }

    return (
        <div className="min-w-[20vw]">
            <Form
                action={createNewsAction}
                successCallback={handleCreate}
                submitText="Lag nyhet"
            >
                <TextInput label="Navn" name="name" />
                <Textarea label="Beskrivelse" name="description" />
                {/*
                  * The levels are collected here rather than after the fact: a news article created
                  * with an empty admin level would be administrable by anyone until it was narrowed.
                  */}
                <div className="flex flex-col gap-[0.5rem]">
                    <h3>Hvem kan administrere nyheten?</h3>
                    <VisibilityMatrixEditor name="visibilityAdminRequirements" />
                    <h3>Hvem kan lese nyheten? (tomt betyr alle)</h3>
                    <VisibilityMatrixEditor name="visibilityRegularRequirements" />
                </div>
            </Form>
        </div>
    )
}
