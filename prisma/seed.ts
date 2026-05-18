import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotent — safe to run in production at any time.
// Only upserts partner charities. No user/company/test data touched.
// Key: everyOrgSlug (stable identifier from Every.org)

const PARTNER_CHARITIES = [
  // ── Global ──────────────────────────────────────────────────────────────
  {
    everyOrgSlug: 'against-malaria-foundation',
    name: 'Against Malaria Foundation',
    description: 'Nets that protect families from malaria — one of the most cost-effective ways to save a life.',
    category: 'health',
    impactMetric: 'nets distributed',
    impactPerPound: '2 nets per £1',
    website: 'https://www.againstmalaria.com',
    regions: JSON.stringify(['global']),
    tracks: JSON.stringify(['fitness', 'balance']),
    featured: true,
  },
  {
    everyOrgSlug: 'givedirectly',
    name: 'GiveDirectly',
    description: 'Direct cash to people in extreme poverty — no middleman, no conditions.',
    category: 'poverty',
    impactMetric: 'direct cash transfers',
    impactPerPound: 'Direct £1 transfer to a family in need',
    website: 'https://www.givedirectly.org',
    regions: JSON.stringify(['global']),
    tracks: JSON.stringify(['fitness', 'focus', 'sleep', 'balance']),
    featured: true,
  },
  {
    everyOrgSlug: 'charity-water',
    name: 'Charity: Water',
    description: 'Clean, safe drinking water for communities in developing countries.',
    category: 'environment',
    impactMetric: 'people with clean water',
    impactPerPound: '1 month of clean water per £1',
    website: 'https://www.charitywater.org',
    regions: JSON.stringify(['global']),
    tracks: JSON.stringify(['fitness', 'sleep', 'balance']),
    featured: true,
  },
  {
    everyOrgSlug: 'room-to-read',
    name: 'Room to Read',
    description: 'Literacy and gender equality in education across Asia and Africa.',
    category: 'education',
    impactMetric: 'children supported',
    impactPerPound: '10 books distributed per £1',
    website: 'https://www.roomtoread.org',
    regions: JSON.stringify(['global']),
    tracks: JSON.stringify(['focus', 'balance']),
    featured: false,
  },
  // ── UK ───────────────────────────────────────────────────────────────────
  {
    everyOrgSlug: 'mind',
    name: 'Mind',
    description: 'Mental health support for anyone who needs it — advice, crisis lines, local services.',
    category: 'health',
    impactMetric: 'people supported',
    impactPerPound: '15 minutes of support per £1',
    website: 'https://www.mind.org.uk',
    regions: JSON.stringify(['GB']),
    tracks: JSON.stringify(['balance', 'sleep', 'focus']),
    featured: true,
  },
  {
    everyOrgSlug: 'british-heart-foundation',
    name: 'British Heart Foundation',
    description: "Funding research into heart and circulatory diseases — the UK's biggest cardiovascular charity.",
    category: 'health',
    impactMetric: 'research funded',
    impactPerPound: 'Funds life-saving heart research',
    website: 'https://www.bhf.org.uk',
    regions: JSON.stringify(['GB']),
    tracks: JSON.stringify(['fitness']),
    featured: true,
  },
  {
    everyOrgSlug: 'shelter',
    name: 'Shelter',
    description: 'Fighting the housing emergency — emergency helplines, legal advice, and campaigning.',
    category: 'poverty',
    impactMetric: 'people helped',
    impactPerPound: '10 minutes of housing advice per £1',
    website: 'https://www.shelter.org.uk',
    regions: JSON.stringify(['GB']),
    tracks: JSON.stringify(['balance', 'focus']),
    featured: false,
  },
  {
    everyOrgSlug: 'macmillan-cancer-support',
    name: 'Macmillan Cancer Support',
    description: 'No one faces cancer alone — from diagnosis through treatment and beyond.',
    category: 'health',
    impactMetric: 'people supported',
    impactPerPound: '30 minutes of nurse support per £1',
    website: 'https://www.macmillan.org.uk',
    regions: JSON.stringify(['GB']),
    tracks: JSON.stringify(['fitness', 'balance']),
    featured: false,
  },
  {
    everyOrgSlug: 'trussell-trust',
    name: 'The Trussell Trust',
    description: 'A network of food banks providing emergency food and support across the UK.',
    category: 'poverty',
    impactMetric: 'meals provided',
    impactPerPound: '3 meals per £1',
    website: 'https://www.trusselltrust.org',
    regions: JSON.stringify(['GB']),
    tracks: JSON.stringify(['balance']),
    featured: false,
  },
  // ── US ───────────────────────────────────────────────────────────────────
  {
    everyOrgSlug: 'feeding-america',
    name: 'Feeding America',
    description: 'The largest hunger-relief organisation in the US — a network of 200 food banks.',
    category: 'poverty',
    impactMetric: 'meals provided',
    impactPerPound: '10 meals per $1',
    website: 'https://www.feedingamerica.org',
    regions: JSON.stringify(['US']),
    tracks: JSON.stringify(['fitness', 'balance']),
    featured: true,
  },
  {
    everyOrgSlug: 'st-jude-childrens-research-hospital',
    name: "St. Jude Children's Research Hospital",
    description: 'Pioneering research and treatment for childhood cancer — families never receive a bill.',
    category: 'health',
    impactMetric: 'children treated',
    impactPerPound: 'Funds free treatment for children with cancer',
    website: 'https://www.stjude.org',
    regions: JSON.stringify(['US']),
    tracks: JSON.stringify(['fitness', 'balance']),
    featured: true,
  },
  {
    everyOrgSlug: 'american-cancer-society',
    name: 'American Cancer Society',
    description: 'Funding cancer research and supporting patients across every state.',
    category: 'health',
    impactMetric: 'research funded',
    impactPerPound: 'Funds cancer research and patient support',
    website: 'https://www.cancer.org',
    regions: JSON.stringify(['US']),
    tracks: JSON.stringify(['fitness', 'balance']),
    featured: false,
  },
  {
    everyOrgSlug: 'mental-health-america',
    name: 'Mental Health America',
    description: 'Promoting mental health and preventing mental illness across the United States.',
    category: 'health',
    impactMetric: 'people screened',
    impactPerPound: 'Funds mental health screening and advocacy',
    website: 'https://www.mhanational.org',
    regions: JSON.stringify(['US']),
    tracks: JSON.stringify(['balance', 'sleep', 'focus']),
    featured: false,
  },
];

async function main() {
  console.log('🌱 Seeding partner charities (idempotent — safe in production)...');

  let created = 0;
  let updated = 0;

  for (const charity of PARTNER_CHARITIES) {
    const { everyOrgSlug, ...data } = charity;
    const result = await prisma.charity.upsert({
      where: { everyOrgSlug },
      create: { everyOrgSlug, ...data, isActive: true },
      update: { ...data, isActive: true },
    });
    // Prisma upsert doesn't tell us create vs update, so check via createdAt
    const ageMs = Date.now() - result.createdAt.getTime();
    if (ageMs < 5000) { created++; } else { updated++; }
  }

  console.log(`✅ ${created} charities created, ${updated} updated`);
  console.log('🎉 Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
