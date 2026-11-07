import type { Document } from '../domain/document.ts'
import { findingsOfAdditionalDocumentsStep } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import {
  type DocumentField,
  documentFieldOf,
  listenToDocumentFields,
  type ReadFile,
} from './document-field.ts'
import { html } from './html.ts'
import type { Context, Step } from './step.ts'

/** The travel justifications of a business travel, as many as needed. */
const travelJustifications: DocumentField = {
  field: 'travelJustifications',
  kind: Kind.additionalDocument,
  holdsOneDocument: false,
  documentsIn: (report: Report) => report.travelJustifications,
  afterAdding: (report: Report, document: Document) =>
    report.afterChanging({ travelJustifications: [...report.travelJustifications, document] }),
}

/** The additional documents of the report, optional, as many as needed. */
const additionalDocuments: DocumentField = {
  field: 'additionalDocuments',
  kind: Kind.additionalDocument,
  holdsOneDocument: false,
  documentsIn: (report: Report) => report.additionalDocuments,
  afterAdding: (report: Report, document: Document) =>
    report.afterChanging({ additionalDocuments: [...report.additionalDocuments, document] }),
}

/** Step 3: the travel justifications of a business travel, then the additional documents. */
export function additionalDocumentsStep(readFile: ReadFile): Step {
  return {
    title: 'Additional documents',

    render(panel: HTMLElement, context: Context): void {
      const report = context.report
      const fields = report.isBusinessTravel
        ? [travelJustifications, additionalDocuments]
        : [additionalDocuments]
      panel.innerHTML = html`<h2>Additional documents</h2>
        ${fields.map((field) => documentFieldOf(field, report))}`.text
      listenToDocumentFields(panel, context, readFile, fields)
    },

    canContinue(report: Report): boolean {
      return findingsOfAdditionalDocumentsStep(report).length === 0
    },
  }
}
