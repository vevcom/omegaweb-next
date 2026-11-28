'use client'
import { Form } from '@/components/Form/Declared/Form'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { AuthorizerDataInput, CallableCapability, ImplementationParamsInput } from '@/hooks/useCapability'
import type { Rule } from '@/services/serviceContract'

/**
 * The editor of a paragraph, as a form that saves itself, for an owner that implements the paragraph's
 * update in its contract. An owner calls it once, with that capability, at the top of a `'use client'`
 * file beside its pages, and exports what it gives as a const of its own, which a page hands to
 * `CmsParagraph` as its `editor`.
 */
export function implementParagraphEditor<EntryRule extends Rule, ImplementationParams = never>({ capability }: {
    capability: ParagraphUpdate<EntryRule, ImplementationParams>,
}) {
    const [Submitter, Field] = Form.Submitter({ capability })

    return function ParagraphEditor(props: ParagraphEditorProps<EntryRule, ImplementationParams>) {
        const { cmsParagraph } = props
        return (
            <Submitter
                {...props}
                params={{ paragraphId: cmsParagraph.id }}
                defaultValues={{ markdown: cmsParagraph.contentMd }}
                autosave
                refreshOnSuccess
            >
                <Field kind="richText" name="markdown" label="Innhold" defaultHtml={cmsParagraph.contentHtml} />
                <Form.SaveStatus />
            </Submitter>
        )
    }
}

// A callable capability may also be one that takes no data, which a paragraph's update never is.
type ParagraphUpdate<EntryRule extends Rule, ImplementationParams> =
    & CallableCapability<{ paragraphId: number }, { markdown: string }, EntryRule, ImplementationParams>
    & { readonly data: object }

type ParagraphEditorProps<EntryRule extends Rule, ImplementationParams> =
    & { cmsParagraph: Pick<CmsParagraph, 'id' | 'contentMd' | 'contentHtml'> }
    & ImplementationParamsInput<ImplementationParams>
    & AuthorizerDataInput<EntryRule>
