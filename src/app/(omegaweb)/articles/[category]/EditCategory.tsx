import { articleCategoryVisibility } from '@/app/(omegaweb)/articles/articleCategoryVisibility'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import Textarea from '@/components/UI/Textarea'
import TextInput from '@/components/UI/TextInput'
import useAuthorizer from '@/hooks/useAuthorizer'
import {
    updateArticleCategoryAction,
    destroyArticleCategoryAction,
    addArticleToCategoryAction,
} from '@/services/articleCategories/actions'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { configureAction } from '@/services/configureAction'
import useSiteRouter from '@/hooks/useSiteRouter'
import { appHref } from '@/lib/sites/href'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import type {
    ExpandedArticleCategory,
    ExpandedArticleCategoryWithVisibility
} from '@/services/articleCategories/types'

type PropTypes = {
    category: ExpandedArticleCategoryWithVisibility
}

export default function EditCategory({ category }: PropTypes) {
    const { refresh, push } = useSiteRouter()
    const canAddArticle = useAuthorizer({
        authorizer: articleCategoryAuth.addArticleToCategory.data({ visibility: category.visibility })
    }).authorized
    const canUpdate = useAuthorizer({
        authorizer: articleCategoryAuth.update.data({ visibility: category.visibility })
    }).authorized
    const canDestroy = useAuthorizer({
        authorizer: articleCategoryAuth.destroy
    }).authorized
    const canUpdateRegularLevel = useAuthorizer({
        authorizer: articleCategoryAuth.updateRegularLevel.data({ visibility: category.visibility })
    }).authorized
    const canUpdateAdminLevel = useAuthorizer({
        authorizer: articleCategoryAuth.updateAdminLevel.data({ visibility: category.visibility })
    }).authorized

    const handleSuccessDestroy = () => {
        push(appHref('/articles'))
        refresh()
    }

    const handleSuccessUpdate = (data: ExpandedArticleCategory | undefined) => {
        if (data) {
            push(appHref(`/articles/${data.name}`))
        }
        refresh()
    }

    const updateCategory = configureAction(
        updateArticleCategoryAction,
        { params: { id: category.id } }
    )

    return (
        <>
            {
                canAddArticle && (
                    <li>
                        <Form
                            action={configureAction(
                                addArticleToCategoryAction,
                                { params: { id: category.id } }
                            )}
                            successCallback={refresh}
                            submitText="Lag ny artikkel"
                        />
                    </li>
                )
            }
            {
                (canUpdate || canUpdateRegularLevel || canUpdateAdminLevel) && (
                    <PopUp
                        popUpKey="editCategory"
                        showButtonClass="
                            w-[30px] h-[30px] absolute top-[2em] right-[1em]
                            max-mobile:top-[1em]
                            bg-transparent border-none text-base-content transition-colors duration-300 ease-in-out
                            hover:cursor-pointer hover:text-primary
                        "
                        showButtonContent={
                            <FontAwesomeIcon icon={faCog} />
                        }
                    >
                        {
                            canUpdate && (
                                <Form
                                    className="w-[50vw]"
                                    action={updateCategory}
                                    successCallback={handleSuccessUpdate}
                                    submitText="Oppdater"
                                >
                                    <TextInput label="Navn" name="name" defaultValue={category.name} />
                                    <Textarea
                                        label="Beskrivelse"
                                        name="description"
                                        defaultValue={category.description || ''}
                                        className="min-h-[150px]"
                                    />
                                </Form>
                            )
                        }
                        <div className="flex flex-col gap-4 mt-[1em]">
                            <articleCategoryVisibility.Forms
                                doubleLevelVisibility={category.visibility}
                                visibilityIds={{ regular: category.visibilityRegularId, admin: category.visibilityAdminId }}
                                params={{ id: category.id }}
                            />
                        </div>
                    </PopUp>
                )
            }
            {
                canDestroy && (
                    <li>
                        <Form
                            action={configureAction(
                                destroyArticleCategoryAction,
                                { params: { id: category.id } }
                            )}
                            successCallback={handleSuccessDestroy}
                            submitText="Slett kategori"
                            submitColor="red"
                            confirmation={{
                                confirm: true,
                                text: 'Er du sikker på at du vil slette denne kategorien?',
                            }}
                        />
                    </li>
                )
            }
        </>
    )
}
