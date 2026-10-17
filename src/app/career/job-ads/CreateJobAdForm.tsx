'use client'
import styles from './CreateJobAdForm.module.scss'
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
        <div className={styles.CreateJobAdForm}>
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
            <CompanyChooser className={styles.companyList} />
        </div>
    )
}
