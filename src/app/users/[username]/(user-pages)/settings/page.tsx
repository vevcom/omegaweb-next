import styles from './page.module.scss'
import UserSettingsForm from './UserProfileSettingsForm'
import UserProfileSettingsCard from './UserProfileSettingsCard'
import ChangeEmailForm from './ChangeEmailForm'
import AdminUserSettingsForm from './AdminUserSettingsForm'
import ChangeClassForm from './ChangeClassForm'
import ManageUserStudyProgrammes from './ManageUserStudyProgrammes'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import Image from '@/components/Image/Image'
import CmsParagraphEditorForm from '@/components/Cms/CmsParagraph/CmsParagraphEditorForm'
import ImageUploader from '@/components/Image/ImageUploader'
import { updateUserBioParagraphContentAction, updateUserProfileImageAction } from '@/services/users/actions'
import { userAuth } from '@/services/users/auth'
import { userOperations } from '@/services/users/operations'
import { classAuth } from '@/services/groups/classes/auth'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import { studyProgrammeOperations } from '@/services/groups/studyProgrammes/operations'
import { serverPage } from '@/app/serverPage'
import { configureAction } from '@/services/configureAction'
import type { PageOperationArgs } from '@/app/serverPage'

/**
 * The first cards are what the user may change about themselves, which an administrator may change
 * for them as well. The rest is for administrators only.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'settings', session)

        // Study programme membership normally comes from Feide. Putting someone on one by hand is
        // an administrator's job, so the form only shows for one - the actions check per programme
        // anyway.
        const studyProgrammes = studyProgrammeAuth.update.auth(session).authorized
            ? await studyProgrammeOperations.readMany({})
            : []
        const privateUser = userAuth.read.data({ userField: { id: profile.user.id } }).auth(session).authorized
            ? await userOperations.read({ params: { id: profile.user.id } })
            : null

        return { profile, studyProgrammes, privateUser }
    },
    capabilities: ({ profile }) => ({
        canUpdateProfile: userAuth.updateProfile.data({
            userField: { username: profile.user.username }
        }),
        canUpdateBio: userAuth.updateBioParagraphContent.data({ userId: profile.user.id }),
        canRegisterNewEmail: userAuth.registerNewEmail.data({ userId: profile.user.id }),
        canUpdateImage: userAuth.updateProfileImage.data({
            userField: { username: profile.user.username }
        }),
        canUpdateUser: userAuth.update,
        canChangeClass: classAuth.changeClassOfUser,
        canManageStudyProgrammes: studyProgrammeAuth.update,
    }),
    render: ({ data, capabilities }) => {
        const { profile, studyProgrammes, privateUser } = data

        return (
            <div className={styles.wrapper}>
                {privateUser && capabilities.canUpdateProfile.authorized && (
                    <UserProfileSettingsCard>
                        <UserSettingsForm user={privateUser} emailDomain={process.env.EMAIL_DOMAIN} />
                    </UserProfileSettingsCard>
                )}
                {capabilities.canUpdateBio.authorized && (
                    <UserProfileSettingsCard>
                        <h2>Bio</h2>
                        <CmsParagraphEditorForm
                            cmsParagraph={profile.user.bioParagraph}
                            updateCmsParagraphAction={configureAction(
                                updateUserBioParagraphContentAction,
                                { implementationParams: { userId: profile.user.id } }
                            )}
                        />
                    </UserProfileSettingsCard>
                )}
                {privateUser && capabilities.canRegisterNewEmail.authorized && (
                    <UserProfileSettingsCard>
                        <ChangeEmailForm user={privateUser} />
                    </UserProfileSettingsCard>
                )}
                {capabilities.canUpdateImage.authorized && (
                    <UserProfileSettingsCard>
                        <h2>Profilbilde</h2>
                        <div className={styles.profileImage}>
                            <Image width={300} image={profile.user.image} alt={profile.user.image.alt} />
                            <ImageUploader
                                title="Endre profilbilde"
                                uploadImageAction={configureAction(
                                    updateUserProfileImageAction,
                                    { params: { username: profile.user.username } }
                                )}
                                refreshOnSuccess
                            />
                        </div>
                    </UserProfileSettingsCard>
                )}
                {capabilities.canUpdateUser.authorized && (
                    <UserProfileSettingsCard>
                        <AdminUserSettingsForm user={profile.user} />
                    </UserProfileSettingsCard>
                )}
                {capabilities.canChangeClass.authorized && (
                    <UserProfileSettingsCard>
                        <ChangeClassForm
                            userId={profile.user.id}
                            currentLevel={profile.class?.level ?? null}
                        />
                    </UserProfileSettingsCard>
                )}
                {capabilities.canManageStudyProgrammes.authorized && (
                    <UserProfileSettingsCard>
                        <ManageUserStudyProgrammes
                            userId={profile.user.id}
                            studyProgrammes={studyProgrammes}
                            memberships={profile.groups.activeStudyProgrammes.map(({ groupId, order }) => ({
                                groupId,
                                order,
                            }))}
                        />
                    </UserProfileSettingsCard>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
