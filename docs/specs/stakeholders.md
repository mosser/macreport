# Stakeholders

## The one user

The system has exactly one user role: the **Claimant**, a member of the
McMaster Centre for Software Certification (McSCert), faculty, student or
staff, or one of its visitors, who spent money on McSCert's behalf and asks
to be reimbursed. They prepare one expense report at a time, on their own
computer, and hand the saved report to McSCert's administration. There is
no administrator role and no reviewer interface.

## Stakeholders

| Stakeholder | Kind | Interest in the system |
|---|---|---|
| Claimant | Direct | Prepares the report. Wants to go from a pile of receipts and bank statements to one complete document without retyping a form or assembling PDFs by hand. |
| McSCert administrative staff | Indirect | Receive the report and process the reimbursement. Never use the system. Want every expense to be traceable to its receipt and its bank statement, and the report to carry what the McSCert Expense Report Template asks for. |
| Supervisor, host | Indirect | The faculty member who supervises a student Claimant, or the McSCert member who hosts a visiting one. Named, with their email, in the report, so that McSCert's administration can reach them. |
| Account holder | Indirect | The holder of the account the expenses are charged to, usually the principal investigator of a grant. Wants the account suggested and the expenses justified. |
| McMaster University financial services | Indirect | Set the reimbursement rules: original receipts, bank statements, and the Missing Receipt Authorization Form when a receipt is missing. |

## Project roles

| Role | Held by | Responsibility |
|---|---|---|
| Sponsor and subject matter expert | Sébastien Mosser | Decides what the report contains and how it is laid out. |
| Engineer | Sébastien Mosser | Development, quality assurance and releases. |

Technical choices (language, framework, deployment) are the Engineer's to make
and are recorded in `docs/adr/`.
