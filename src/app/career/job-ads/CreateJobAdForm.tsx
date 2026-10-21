'use client'
import CompanyChooser from './CompanyChooser'
import SelectedCompany from './SelectedCompany'
import { createJobAdAction } from '@/services/career/jobAds/actions'
import TextInput from '@/components/UI/TextInput'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import { jobAdOptions } from '@/services/career/jobAds/constants'
import DateInput from '@/components/UI/DateInput'

export default function CreateJobAdForm() {
    return (
        <div
            className="
                mobile:grid mobile:grid-cols-[minmax(240px,320px)_1fr] mobile:gap-8 mobile:min-w-[80vw]
                mobile:max-h-[80vh] mobile:items-start
                max-mobile:flex max-mobile:flex-col max-mobile:gap-6
            "
        >
            <Form
                title="Lag en ny stillingsannonse"
                submitText="Opprett"
                action={createJobAdAction}
                refreshOnSuccess
            >
                <TextInput label="Tittel" name="articleName"/>
                <TextInput label="Beskrivelse" name="description"/>
                <TextInput label="Sted" name="location"/>
                <SelectedCompany />
                <SelectString options={jobAdOptions} label="Type" name="type"/>
                <DateInput includeTime label="Søknadsfrist" name="applicationDeadline"/>
            </Form>
            <CompanyChooser className="
                mobile:min-h-0 mobile:h-[80vh]
                max-mobile:max-h-[50vh]
            " />
        </div>
    )
}
