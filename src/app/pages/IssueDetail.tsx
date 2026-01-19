import { useParams } from 'react-router'

function IssueDetail() {
  const { issueId } = useParams<{ issueId: string }>()

  return (
    <div>
      <h1>Issue Detail</h1>
      <p>Viewing issue: {issueId}</p>
    </div>
  )
}

export default IssueDetail
