// Sample/placeholder opportunities data. Swap for real Supabase-backed
// content once opportunities are scoped for the Admin CRUD flow.

export const opportunities = [
  {
    id: 'mtn-foundation-scholarship',
    type: 'Scholarship',
    title: 'MTN Foundation STEM Scholarship',
    org: 'MTN Foundation',
    deadline: 'Sep 30, 2026',
    link: 'https://example.com/opportunities/mtn-foundation-scholarship',
  },
  {
    id: 'dangote-industrial-internship',
    type: 'Internship',
    title: 'Dangote Cement Industrial Internship',
    org: 'Dangote Cement Plc',
    deadline: 'Aug 15, 2026',
    link: 'https://example.com/opportunities/dangote-industrial-internship',
  },
  {
    id: 'petan-undergraduate-scholarship',
    type: 'Scholarship',
    title: 'PETAN Undergraduate Scholarship',
    org: 'Petroleum Technology Association of Nigeria',
    deadline: 'Oct 20, 2026',
    link: 'https://example.com/opportunities/petan-undergraduate-scholarship',
  },
  {
    id: 'nlng-siwes-internship',
    type: 'Internship',
    title: 'NLNG SIWES Placement',
    org: 'Nigeria LNG Limited',
    deadline: 'Jul 31, 2026',
    link: 'https://example.com/opportunities/nlng-siwes-internship',
  },
]

export function getOpportunities() {
  return [...opportunities].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
}
