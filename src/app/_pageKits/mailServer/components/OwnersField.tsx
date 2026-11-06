'use client'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import type { VisibilityRequirement } from '@/services/visibility/types'

/**
 * The owners of an alias or a mailing list as a form field: whoever passes the requirements owns
 * it, and none at all leaves it to the mail server admins. Rendered inside a Form, posted as
 * `ownerRequirements`.
 */
export default function OwnersField({
    requirements,
    onChange,
}: {
    requirements: VisibilityRequirement[],
    onChange: (requirements: VisibilityRequirement[]) => void,
}) {
    return <div className="flex flex-col gap-2">
        <h3 className="m-0">Eiere</h3>
        <p className="m-0 text-text-muted text-[0.9rem]">
            Eierne ser og kobler det de eier. Uten eiere er det bare e-posttjeneradministratorene som gjør det.
        </p>
        <VisibilityMatrixEditor requirements={requirements} onChange={onChange} />
        <input type="hidden" name="ownerRequirements" value={JSON.stringify(requirements)} />
    </div>
}
