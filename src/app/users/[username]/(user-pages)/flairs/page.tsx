import styles from './page.module.scss'
import {
    assignFlairToUserAction,
    unAssignFlairToUserAction
} from '@/services/flairs/actions'
import { flairOperations } from '@/services/flairs/operations'
import Form from '@/components/Form/Form'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/serverPage'
import Flair from '@/components/Flair/Flair'
import { configureAction } from '@/services/configureAction'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'flairs', session)

        const [usersFlairs, allFlairs] = await Promise.all([
            flairOperations.readUserFlairs({ params: { userId: profile.user.id } }),
            flairOperations.readAll({}),
        ])

        const flairs = allFlairs.map(flair => ({
            ...flair,
            assignedToUser: usersFlairs.some(userFlair => userFlair.id === flair.id)
        })).sort((flairOne, flairTwo) => flairOne.rank - flairTwo.rank)

        return { profile, flairs }
    },
    render: ({ data }) => (
        <div className={styles.wrapper}>
            <div className={styles.flairContainer}>
                <p>
                    Flairen med lavest rank er den som vises først på brukerens profil, og
                    den som bestemmer fargen på brukerprofilen.
                </p>
                <table className={styles.flairList}>
                    <thead>
                        <tr>
                            <th>Flair</th>
                            <th>Navn</th>
                            <th>Rank</th>
                            <th>Farge</th>
                            <th>Handling</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.flairs.map((flair) => (
                            <tr key={flair.id}>
                                <td><Flair flair={flair} width={100} /></td>
                                <td>{flair.name}</td>
                                <td>{flair.rank}</td>
                                <td style={{
                                    backgroundColor: `rgb(${flair.colorR}, ${flair.colorG}, ${flair.colorB})`
                                }}>
                                </td>
                                <td>
                                    <Form
                                        submitText={flair.assignedToUser ? 'Fjern' : 'Tildel'}
                                        refreshOnSuccess
                                        submitColor={flair.assignedToUser ? 'red' : 'green'}
                                        action={
                                            flair.assignedToUser
                                                ? configureAction(
                                                    unAssignFlairToUserAction,
                                                    { params: {
                                                        userId: data.profile.user.id,
                                                        flairId: flair.id,
                                                    } }
                                                )
                                                : configureAction(
                                                    assignFlairToUserAction,
                                                    { params: {
                                                        userId: data.profile.user.id,
                                                        flairId: flair.id,
                                                    } }
                                                )
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div >
    ),
})

export default page
export { generateMetadata }
