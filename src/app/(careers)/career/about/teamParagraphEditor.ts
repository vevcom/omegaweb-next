'use client'
import { implementParagraphEditor } from '@/components/Cms/CmsParagraph/DeclaredParagraphEditor'
import { careersTeamCapabilities } from '@/capabilities/careers/team/capabilities'

export const TeamDepartmentParagraphEditor = implementParagraphEditor({
    capability: careersTeamCapabilities.updateDepartmentParagraph,
})
