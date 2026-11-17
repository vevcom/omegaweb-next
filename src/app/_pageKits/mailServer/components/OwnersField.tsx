'use client'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'

/** The owners of a new alias or mailing list: whoever passes the requirements, and only mail server admins given none. */
export default function OwnersField() {
    return <div className="flex flex-col gap-2">
        <h3 className="m-0">Eiere</h3>
        <p className="m-0 text-base-content/80 text-[0.9rem]">
            Eierne ser og kobler det de eier. Uten eiere er det bare e-posttjeneradministratorene som gjør det.
        </p>
        <VisibilityMatrixEditor
            name="ownerRequirements"
            verb="ser og kobler dette"
            everyone="Bare e-posttjeneradministratorene"
        />
    </div>
}
