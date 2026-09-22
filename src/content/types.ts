export type Verification = 'verified' | 'source-set' | 'needs-audit'
export type Tier = 1 | 2 | 3

export interface Fact {
  id: string
  theme: string
  category: string
  title: string
  value: string
  /** true when the title is just the start of the value, so it cannot be used as a recall cue */
  titleIsValue: boolean
  period?: string
  source: string
  sourceUrl?: string
  evidenceType: string
  role: string
  priority: 'A' | 'B' | 'C'
  tier: Tier
  tags: string[]
  proves: string
  deploy: string
  whyItMatters?: string
  qualification?: string
  theoryLink?: string
  benchmark?: { standard?: string; value?: string; lmic?: string; peer?: string; gap?: string }
  pairsWith: string[]
  memoryHook?: string
  useAgainst?: string
  chainIds: string[]
  verification: Verification
  verificationNote: string
}

export interface Chain {
  id: string
  kind: 'chain' | 'map'
  title: string
  links: string[]
  evidenceIds: string[]
  subjects: string[]
  coreLogic?: string
  counter?: string
  policy?: string[]
}

export interface Quote {
  id: string
  author: string
  text: string
  year?: string
  argument: string
  evidenceIds: string[]
  deploy?: string
  source?: string
}

export interface PastQuestion {
  id: string
  text: string
  period?: string
  tags: string[]
}

export interface Issue {
  level: 'error' | 'warn' | 'info'
  code: string
  ref: string
  message: string
}

export interface Pack {
  id: string
  name: string
  builtAt: string
  facts: Fact[]
  chains: Chain[]
  quotes: Quote[]
  questions: PastQuestion[]
  issues: Issue[]
}

/** A drafted Layer-B enrichment awaiting a reviewer's decision inside the app. */
export interface ProposalFields {
  qualification: string
  pairsWith: string[]
  hook: string
  useAgainst: string
  /** a model sentence in different wording from 'proves'; drafted, reviewed */
  deploy?: string
}
export interface Proposal {
  id: string
  factId: string
  field: ProposalFields
  draftIssues: string[]
  status: 'pending' | 'approved' | 'revised' | 'rejected'
  draftedAt: string
}
