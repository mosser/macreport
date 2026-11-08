import configured from '../../config/policy.json' with { type: 'json' }
import { charactersNotWritableIn } from './writable-characters.ts'

/** A document of the policy: its name, as the report document writes it, and where it is. */
export interface PolicyDocument {
  readonly name: string
  readonly url: string
}

/** The documents setting the rules of reimbursement, as `config/policy.json` lists them. */
export class Policy {
  readonly documents: readonly PolicyDocument[]

  private constructor(documents: readonly PolicyDocument[]) {
    this.documents = documents
  }

  /**
   * The policy a configuration gives, as `config/policy.json` holds it: at least one document, each
   * a name and an address. Throws a TypeError when the configuration holds anything else; a
   * RangeError for a name empty or that the report document cannot write, or an address that is not
   * https.
   */
  static from(configuration: unknown): Policy {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('The policy is not an object')
    }
    const { documents } = configuration as { documents?: unknown }
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new TypeError('The policy holds at least one document')
    }
    return new Policy(documents.map(documentOf))
  }
}

function documentOf(value: unknown): PolicyDocument {
  const { name, url } = (value ?? {}) as { name?: unknown; url?: unknown }
  if (typeof name !== 'string' || typeof url !== 'string') {
    throw new TypeError('A document of the policy has a name and an address')
  }
  if (name.trim() === '' || charactersNotWritableIn(name).length > 0) {
    throw new RangeError(`The report document cannot write the name of a policy document: ${name}`)
  }
  if (!URL.canParse(url) || new URL(url).protocol !== 'https:') {
    throw new RangeError(`The address of a policy document is not https: ${url}`)
  }
  return { name, url }
}

/** The policy of the system, from `config/policy.json`, read when the system is built. */
export const policy = Policy.from(configured)
