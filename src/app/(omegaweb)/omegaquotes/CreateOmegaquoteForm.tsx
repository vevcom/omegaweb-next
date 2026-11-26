import { CreateQuoteField, CreateQuoteSubmitter } from './omegaquoteSubmitters'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'

export default function CreateOmegaquoteForm({ userId }: { userId: number }) {
    return (
        <AddHeaderItemPopUp popUpKey="new_omega_quote">
            <CreateQuoteSubmitter
                params={{ userPosterId: userId }}
                authorizerData={{ userId }}
                title="Ny Omegaquote"
                submitText="Legg til"
                refreshOnSuccess
                closePopUpOnSuccess="new_omega_quote"
                className="w-[400px]"
            >
                <CreateQuoteField
                    kind="text"
                    name="quote"
                    label="Omegaquote"
                    placeholder="Omegaquote"
                    className="h-[100px] max-h-[300px]"
                />
                <CreateQuoteField kind="string" name="author" label="Sagt av" className="
                    w-full max-w-full
                    [&_input]:w-full
                "/>
            </CreateQuoteSubmitter>
        </AddHeaderItemPopUp>
    )
}
