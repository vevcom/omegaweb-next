import CreateDotForm from './CreateDotForm'
import DotExpieries from './DotExpieries'
import DotSettings from './DotSettings'
import DateDisplay from '@/components/Date/Date'
import type { DotExpanded } from '@/services/dots/types'

type PropTypes = {
    userId: number,
    dots: DotExpanded[],
    showCreateForm: boolean,
    showUpdateForm: boolean,
    showDestroyForm: boolean,
}

/**
 * Displays the dots of a single user with the expiry infered for each of their dot values.
 *
 * Choose which CRUD operations are offered using the show*Form props.
 * This should be linked to the authorizers.
 *
 * @param userId - The user the dots belong to. New dots are given to this user.
 * @param dots - The dots of the user, in ascending order of expiry.
 * @param showCreateForm - Whether to offer giving a new dot to the user.
 * @param showUpdateForm - Whether to offer changing the dots.
 * @param showDestroyForm - Whether to offer deleting the dots.
 */
const dotsClassName = (valueLeft: number) => `py-[0.2em]! px-[0.6em]! rounded-[0.4em] whitespace-nowrap ${
    valueLeft > 0
        ? 'bg-[color-mix(in_srgb,var(--accent-red),white_50%)] text-text-inv'
        : 'bg-[color-mix(in_srgb,var(--accent-green),white_50%)] text-text-inv'
}`

export default function UserDots({
    userId,
    dots,
    showCreateForm,
    showUpdateForm,
    showDestroyForm,
}: PropTypes) {
    const valueLeft = dots.reduce((total, dot) => total + dot.valueLeft, 0)
    const showSettings = showUpdateForm || showDestroyForm

    return (
        <div>
            <div className="flex flex-row flex-wrap items-center gap-2">
                <span className={dotsClassName(valueLeft)}>
                    {valueLeft} aktive {valueLeft === 1 ? 'prikk' : 'prikker'}
                </span>
                {showCreateForm && <CreateDotForm userId={userId} />}
            </div>
            {
                dots.length === 0 ?
                    <i>Ingen prikker å vise</i> :
                    <table className="ohma-table">
                        <thead>
                            <tr>
                                <th>Grunn</th>
                                <th>Gitt av</th>
                                <th>Gitt</th>
                                <th>Igjen</th>
                                <th>Utløpstider</th>
                                {showSettings && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {
                                dots.map(dot => (
                                    <tr key={dot.id}>
                                        <td>{dot.reason}</td>
                                        <td>{dot.accuser.username}</td>
                                        <td><DateDisplay date={dot.createdAt} includeTime={false} /></td>
                                        <td className={dotsClassName(dot.valueLeft)}>
                                            {dot.valueLeft} / {dot.value}
                                        </td>
                                        <td><DotExpieries dot={dot} /></td>
                                        {
                                            showSettings &&
                                            <td>
                                                <DotSettings
                                                    dot={dot}
                                                    showUpdateForm={showUpdateForm}
                                                    showDestroyForm={showDestroyForm}
                                                />
                                            </td>
                                        }
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
            }
        </div>
    )
}
