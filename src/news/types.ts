// Shapes written by news/run.mjs. Field names are short because these files are downloaded on phones.
export interface NewsStory {
  id: string
  o: string // outlet
  l: 'en' | 'ur'
  g: 'pk-en' | 'pk-ur' | 'intl'
  k: 'news' | 'opinion' | 'business'
  t: string // title, verbatim
  u: string // link to the original
  at: number
  sn: string // publisher's snippet, verbatim, max 300 chars
  c?: string // cluster id
  n?: number // outlets covering the same event
  ps: { s: number; b: string[]; f: string[]; th: string[]; m: string[] }
  as?: { keep: 0 | 1; role?: string; use?: string[]; map?: string; th?: string; reuse?: number; t1?: number; why?: string }
}

export interface NewsIndex {
  updatedAt: string
  assessMode: 'cli' | 'rules'
  days: { date: string; count: number; kept: number }[]
  health: { id: string; name: string; lang: string; ok: boolean; items: number; newest: number | null; note: string }[]
  unavailable: { name: string; reason: string }[]
  labels: { rule: Record<string, string>; flag: Record<string, string>; roles: Record<string, string>; papers: Record<string, string>; maps: Record<string, string> }
}

export interface Candidate {
  id: string
  sid: string
  title: string
  value: string
  period: string
  src: string
  type: string
  role: string
  theme: string
  tags: string[]
  map: string
  proves: string
  method: string
  cautions: string[]
  quote: string
  t1?: number
  use?: string[]
  match: { kind: 'new' | 'update' | 'conflict' | 'duplicate'; factId?: string; similarity?: number }
  story: { id: string; outlet: string; title: string; link: string; at: number; lang: string }
  status: 'pending' | 'approved' | 'revised' | 'rejected'
  extractedAt: string
}
