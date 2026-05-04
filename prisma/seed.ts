import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Delete existing data (for clean slate)
  console.log('Cleaning existing data...');
  await prisma.donation.deleteMany({});
  await prisma.impactWallet.deleteMany({});
  await prisma.streak.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.season.deleteMany({});
  await prisma.impactStory.deleteMany({});
  await prisma.magicLink.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  await prisma.charity.deleteMany({});

  // Create charities
  console.log('Creating charities...');
  const charities = await Promise.all([
    // ── Global ──────────────────────────────────────────────────────
    prisma.charity.create({ data: {
      name: 'Against Malaria Foundation',
      description: 'Nets that protect families from malaria — one of the most cost-effective ways to save a life.',
      category: 'health',
      impactMetric: 'nets distributed',
      impactPerPound: '2 nets per £1',
      website: 'https://www.againstmalaria.com',
      everyOrgSlug: 'against-malaria-foundation',
      regions: JSON.stringify(['global']),
      tracks: JSON.stringify(['fitness', 'balance']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'GiveDirectly',
      description: 'Direct cash to people in extreme poverty — no middleman, no conditions.',
      category: 'poverty',
      impactMetric: 'direct cash transfers',
      impactPerPound: 'Direct £1 transfer to a family in need',
      website: 'https://www.givedirectly.org',
      everyOrgSlug: 'givedirectly',
      regions: JSON.stringify(['global']),
      tracks: JSON.stringify(['fitness', 'focus', 'sleep', 'balance']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'Charity: Water',
      description: 'Clean, safe drinking water for communities in developing countries.',
      category: 'environment',
      impactMetric: 'people with clean water',
      impactPerPound: '1 month of clean water per £1',
      website: 'https://www.charitywater.org',
      everyOrgSlug: 'charity-water',
      regions: JSON.stringify(['global']),
      tracks: JSON.stringify(['fitness', 'sleep', 'balance']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'Room to Read',
      description: 'Literacy and gender equality in education across Asia and Africa.',
      category: 'education',
      impactMetric: 'children supported',
      impactPerPound: '10 books distributed per £1',
      website: 'https://www.roomtoread.org',
      everyOrgSlug: 'room-to-read',
      regions: JSON.stringify(['global']),
      tracks: JSON.stringify(['focus', 'balance']),
      featured: false,
      isActive: true,
    }}),
    // ── UK ──────────────────────────────────────────────────────────
    prisma.charity.create({ data: {
      name: 'Mind',
      description: 'Mental health support for anyone who needs it — advice, crisis lines, local services.',
      category: 'health',
      impactMetric: 'people supported',
      impactPerPound: '15 minutes of support per £1',
      website: 'https://www.mind.org.uk',
      everyOrgSlug: 'mind',
      regions: JSON.stringify(['GB']),
      tracks: JSON.stringify(['balance', 'sleep', 'focus']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'British Heart Foundation',
      description: 'Funding research into heart and circulatory diseases — the UK\'s biggest cardiovascular charity.',
      category: 'health',
      impactMetric: 'research funded',
      impactPerPound: 'Funds life-saving heart research',
      website: 'https://www.bhf.org.uk',
      everyOrgSlug: 'british-heart-foundation',
      regions: JSON.stringify(['GB']),
      tracks: JSON.stringify(['fitness']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'Shelter',
      description: 'Fighting the housing emergency — emergency helplines, legal advice, and campaigning.',
      category: 'poverty',
      impactMetric: 'people helped',
      impactPerPound: '10 minutes of housing advice per £1',
      website: 'https://www.shelter.org.uk',
      everyOrgSlug: 'shelter',
      regions: JSON.stringify(['GB']),
      tracks: JSON.stringify(['balance', 'focus']),
      featured: false,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'Macmillan Cancer Support',
      description: 'No one faces cancer alone — from diagnosis through treatment and beyond.',
      category: 'health',
      impactMetric: 'people supported',
      impactPerPound: '30 minutes of nurse support per £1',
      website: 'https://www.macmillan.org.uk',
      everyOrgSlug: 'macmillan-cancer-support',
      regions: JSON.stringify(['GB']),
      tracks: JSON.stringify(['fitness', 'balance']),
      featured: false,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'The Trussell Trust',
      description: 'A network of food banks providing emergency food and support across the UK.',
      category: 'poverty',
      impactMetric: 'meals provided',
      impactPerPound: '3 meals per £1',
      website: 'https://www.trusselltrust.org',
      everyOrgSlug: 'trussell-trust',
      regions: JSON.stringify(['GB']),
      tracks: JSON.stringify(['balance']),
      featured: false,
      isActive: true,
    }}),
    // ── US ──────────────────────────────────────────────────────────
    prisma.charity.create({ data: {
      name: 'Feeding America',
      description: 'The largest hunger-relief organisation in the US — a network of 200 food banks.',
      category: 'poverty',
      impactMetric: 'meals provided',
      impactPerPound: '10 meals per $1',
      website: 'https://www.feedingamerica.org',
      everyOrgSlug: 'feeding-america',
      regions: JSON.stringify(['US']),
      tracks: JSON.stringify(['fitness', 'balance']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'St. Jude Children\'s Research Hospital',
      description: 'Pioneering research and treatment for childhood cancer — families never receive a bill.',
      category: 'health',
      impactMetric: 'children treated',
      impactPerPound: 'Funds free treatment for children with cancer',
      website: 'https://www.stjude.org',
      everyOrgSlug: 'st-jude-childrens-research-hospital',
      regions: JSON.stringify(['US']),
      tracks: JSON.stringify(['fitness', 'balance']),
      featured: true,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'American Cancer Society',
      description: 'Funding cancer research and supporting patients across every state.',
      category: 'health',
      impactMetric: 'research funded',
      impactPerPound: 'Funds cancer research and patient support',
      website: 'https://www.cancer.org',
      everyOrgSlug: 'american-cancer-society',
      regions: JSON.stringify(['US']),
      tracks: JSON.stringify(['fitness', 'balance']),
      featured: false,
      isActive: true,
    }}),
    prisma.charity.create({ data: {
      name: 'Mental Health America',
      description: 'Promoting mental health and preventing mental illness across the United States.',
      category: 'health',
      impactMetric: 'people screened',
      impactPerPound: 'Funds mental health screening and advocacy',
      website: 'https://www.mhanational.org',
      everyOrgSlug: 'mental-health-america',
      regions: JSON.stringify(['US']),
      tracks: JSON.stringify(['balance', 'sleep', 'focus']),
      featured: false,
      isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${charities.length} charities`);

  // Create test users
  console.log('Creating test users...');

  const testUser1 = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      phone: '+447700900001',
      firstName: 'Alice',
      lastName: 'Johnson',
      timezone: 'Europe/London',
      subscriptionTier: 'PRO',
      subscriptionStatus: 'active',
      track: 'fitness',
      goal: 'Run 5K without stopping',
      minimumMode: '10 minute walk',
      giftFrame: 'My kids',
      morningCallTime: '07:00',
      eveningCallTime: '20:00',
      callFrequency: 3,
      preferredDays: JSON.stringify(['monday', 'wednesday', 'friday']),
      preferredCharityId: charities[0].id,
      isActive: true,
      isOnboarded: true,
      onboardedAt: new Date(),
    },
  });

  const testUser2 = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      phone: '+447700900002',
      firstName: 'Bob',
      lastName: 'Smith',
      timezone: 'Europe/London',
      subscriptionTier: 'ELITE',
      subscriptionStatus: 'active',
      track: 'focus',
      goal: 'Meditate daily for 20 minutes',
      minimumMode: '5 minutes breathing',
      giftFrame: 'My mental health',
      morningCallTime: '06:30',
      eveningCallTime: '21:00',
      callFrequency: 4,
      preferredDays: JSON.stringify(['monday', 'tuesday', 'thursday', 'friday']),
      preferredCharityId: charities[4].id, // Mind
      isActive: true,
      isOnboarded: true,
      onboardedAt: new Date(),
      googleCalendarConnected: true,
    },
  });

  const testUser3 = await prisma.user.create({
    data: {
      email: 'charlie@example.com',
      phone: '+447700900003',
      firstName: 'Charlie',
      lastName: 'Davis',
      timezone: 'Europe/London',
      subscriptionTier: 'FREE',
      subscriptionStatus: 'active',
      track: 'balance',
      goal: 'Read 30 minutes before bed',
      minimumMode: '10 minutes reading',
      giftFrame: 'Personal growth',
      morningCallTime: '08:00',
      eveningCallTime: '22:00',
      callFrequency: 2,
      preferredDays: JSON.stringify(['tuesday', 'thursday']),
      preferredCharityId: charities[3].id, // Room to Read
      isActive: true,
      isOnboarded: false,
    },
  });

  console.log(`✅ Created 3 test users`);

  // Create Season + Sprints for testUser1
  console.log('Creating Season and Sprints for testUser1...');

  const season1 = await prisma.season.create({
    data: {
      userId: testUser1.id,
      number: 1,
      title: 'Operation Ironman',
      goal: 'Run 5K without stopping',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // started 30 days ago
      endDate: new Date(Date.now() + 54 * 24 * 60 * 60 * 1000),   // ends in 54 days
      status: 'ACTIVE',
    }
  });

  // Sprint 1 (completed)
  await prisma.sprint.create({ data: { seasonId: season1.id, number: 1, startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: 'COMPLETED', completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } });
  // Sprint 2 (active)
  await prisma.sprint.create({ data: { seasonId: season1.id, number: 2, startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000), status: 'ACTIVE' } });
  // Sprint 3 (future)
  await prisma.sprint.create({ data: { seasonId: season1.id, number: 3, startDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000), status: 'ACTIVE' } });

  console.log(`✅ Created Season 1 with 3 Sprints for testUser1`);

  // Create Impact Wallets for test users
  console.log('Creating Impact Wallets...');

  await Promise.all([
    prisma.impactWallet.create({
      data: {
        userId: testUser1.id,
        monthlyLimit: 20,
        dailyCap: 3,
        currentMonthSpent: 5.5,
        monthStartDate: new Date(),
        lifetimeDonated: 45.75,
      },
    }),
    prisma.impactWallet.create({
      data: {
        userId: testUser2.id,
        monthlyLimit: 30,
        dailyCap: 4,
        currentMonthSpent: 12.0,
        monthStartDate: new Date(),
        lifetimeDonated: 98.50,
      },
    }),
    prisma.impactWallet.create({
      data: {
        userId: testUser3.id,
        monthlyLimit: 20,
        dailyCap: 3,
        currentMonthSpent: 0,
        monthStartDate: new Date(),
        lifetimeDonated: 0,
      },
    }),
  ]);

  console.log(`✅ Created 3 Impact Wallets`);

  // Create Streaks for test users
  console.log('Creating Streaks...');

  await Promise.all([
    prisma.streak.create({
      data: {
        userId: testUser1.id,
        currentStreak: 5,
        currentStreakStart: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        longestStreak: 21,
        longestStreakStart: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        longestStreakEnd: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        lastWorkoutDate: new Date(),
        bonus7DayClaimed: true,
        bonus30DayClaimed: false,
        bonus90DayClaimed: false,
      },
    }),
    prisma.streak.create({
      data: {
        userId: testUser2.id,
        currentStreak: 12,
        currentStreakStart: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        longestStreak: 35,
        longestStreakStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        longestStreakEnd: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000),
        lastWorkoutDate: new Date(),
        bonus7DayClaimed: true,
        bonus30DayClaimed: true,
        bonus90DayClaimed: false,
      },
    }),
    prisma.streak.create({
      data: {
        userId: testUser3.id,
        currentStreak: 0,
        longestStreak: 0,
        bonus7DayClaimed: false,
        bonus30DayClaimed: false,
        bonus90DayClaimed: false,
      },
    }),
  ]);

  console.log(`✅ Created 3 Streaks`);

  // Create a test company for B2B
  console.log('Creating test company...');

  const testCompany = await prisma.company.create({
    data: {
      name: 'Acme Corp',
      contactEmail: 'hr@acmecorp.com',
      contactName: 'Jane Smith',
      currentSeason: 1,
      seasonStartDate: new Date(),
      seasonEndDate: new Date(Date.now() + 56 * 24 * 60 * 60 * 1000), // 8 weeks
      seasonDuration: 8,
      platformFeePerUser: 15.00,
      impactWalletPerUser: 25.00,
      isActive: true,
    },
  });

  console.log(`✅ Created test company: ${testCompany.name}`);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
