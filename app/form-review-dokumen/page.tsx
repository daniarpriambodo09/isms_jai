import { redirect } from 'next/navigation'

// The Form Review is no longer a register of its own: it is uploaded beside
// its document in Prosedur ISMS / Standard Requirement TMMIN and signed with
// it. Old links (e-mails, bookmarks) land on Prosedur ISMS.
export default function FormReviewDokumenPage() {
  redirect('/prosedur-isms')
}
