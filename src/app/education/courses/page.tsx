import CreateCourseForm from './CreateCourseForm'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { courseOperations } from '@/services/education/courses/operations'
import { courseAuth } from '@/services/education/courses/auth'
import { schoolOperations } from '@/services/education/schools/operations'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => {
        const [courses, schools] = await Promise.all([
            courseOperations.readMany({ params: {} }),
            schoolOperations.readMany({ params: { onlyNonStandard: false } }),
        ])
        return { courses, schools }
    },
    capabilities: () => ({
        canCreate: courseAuth.create,
    }),
    metadata: () => ({ title: 'Emner' }),
    render: ({ data: { courses, schools }, capabilities }) => (
        <PageWrapper headerItem={capabilities.canCreate.authorized && (
            <AddHeaderItemPopUp popUpKey="createCourse">
                <CreateCourseForm schools={schools} />
            </AddHeaderItemPopUp>
        )}>
            {courses.length ? (
                <table>
                    <thead>
                        <tr>
                            <th>Emnekode</th>
                            <th>Navn</th>
                            <th>Studiepoeng</th>
                            <th>Skole</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(course => (
                            <tr key={course.id}>
                                <td>{course.code}</td>
                                <td>{course.name}</td>
                                <td>{course.ectsPoints}</td>
                                <td>{course.school.shortName}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p>Ingen emner ennå.</p>}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
