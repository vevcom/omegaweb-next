import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import Textarea from '@/components/UI/Textarea'
import TextInput from '@/components/UI/TextInput'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import useAuthorizer from '@/hooks/useAuthorizer'
import {
    updateArticleCategoryAction,
    destroyArticleCategoryAction,
    addArticleToCategoryAction,
    updateArticleCategoryRegularLevelVisibilityAction,
    updateArticleCategoryAdminLevelVisibilityAction,
} from '@/services/articleCategories/actions'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import type {
    ExpandedArticleCategory,
    ExpandedArticleCategoryWithVisibility
} from '@/services/articleCategories/types'

type PropTypes = {
    category: ExpandedArticleCategoryWithVisibility
}

const openEditCategoryClassName = [
    'w-[30px] h-[30px] absolute top-[2em] right-[1em] max-mobile:top-[1em] bg-transparent border-none',
    'text-text transition-colors duration-300 ease-in-out hover:cursor-pointer hover:text-accent-blue',
].join(' ')

export default function EditCategory({ category }: PropTypes) {
    const { refresh, push } = useRouter()
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
        push('/articles')
        refresh()
    }

    const handleSuccessUpdate = (data: ExpandedArticleCategory | undefined) => {
        if (data) {
            push(`/articles/${data.name}`)
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
                        showButtonClass={openEditCategoryClassName}
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
                        {
                            canUpdateRegularLevel && (
                                <div className="flex flex-col gap-[0.5rem] mt-[1em]">
                                    <h3>Hvem kan lese artiklene?</h3>
                                    <VisibilityAdmin
                                        visibility={category.visibility.regularLevel}
                                        visibilityId={category.visibilityRegularId}
                                        updateVisibilityAction={configureAction(
                                            updateArticleCategoryRegularLevelVisibilityAction,
                                            { implementationParams: { id: category.id } }
                                        )}
                                    />
                                </div>
                            )
                        }
                        {
                            canUpdateAdminLevel && (
                                <div className="flex flex-col gap-[0.5rem] mt-[1em]">
                                    <h3>Hvem kan redigere artiklene?</h3>
                                    <VisibilityAdmin
                                        visibility={category.visibility.adminLevel}
                                        visibilityId={category.visibilityAdminId}
                                        updateVisibilityAction={configureAction(
                                            updateArticleCategoryAdminLevelVisibilityAction,
                                            { implementationParams: { id: category.id } }
                                        )}
                                    />
                                </div>
                            )
                        }
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
