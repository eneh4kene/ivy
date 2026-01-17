import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create charities
  console.log('Creating charities...');
  const charities = await Promise.all([
    prisma.charity.upsert({
      where: { name: 'Against Malaria Foundation' },
      update: {},
      create: {
        name: 'Against Malaria Foundation',
        description: 'Providing insecticide-treated nets to protect families from malaria',
        category: 'health',
        impactMetric: 'Nets distributed',
        impactPerPound: '2 nets per £1',
        logoUrl: 'https://example.com/amf-logo.png',
        website: 'https://www.againstmalaria.com',
        isActive: true,
      },
    }),
    prisma.charity.upsert({
      where: { name: 'GiveDirectly' },
      update: {},
      create: {
        name: 'GiveDirectly',
        description: 'Direct cash transfers to people living in extreme poverty',
        category: 'poverty',
        impactMetric: 'Direct cash transfers',
        impactPerPound: 'Direct £1 transfer',
        logoUrl: 'https://example.com/givedirectly-logo.png',
        website: 'https://www.givedirectly.org',
        isActive: true,
      },
    }),
    prisma.charity.upsert({
      where: { name: 'The Ocean Cleanup' },
      update: {},
      create: {
        name: 'The Ocean Cleanup',
        description: 'Developing advanced technologies to rid the oceans of plastic',
        category: 'environment',
        impactMetric: 'Plastic removed',
        impactPerPound: '5kg plastic per £1',
        logoUrl: 'https://example.com/ocean-cleanup-logo.png',
        website: 'https://theoceancleanup.com',
        isActive: true,
      },
    }),
    prisma.charity.upsert({
      where: { name: 'Room to Read' },
      update: {},
      create: {
        name: 'Room to Read',
        description: 'Improving literacy and gender equality in education',
        category: 'education',
        impactMetric: 'Books distributed',
        impactPerPound: '10 books per £1',
        logoUrl: 'https://example.com/roomtoread-logo.png',
        website: 'https://www.roomtoread.org',
        isActive: true,
      },
    }),
    prisma.charity.upsert({
      where: { name: 'Mind (Mental Health)' },
      update: {},
      create: {
        name: 'Mind (Mental Health)',
        description: 'Providing advice and support to empower anyone experiencing a mental health problem',
        category: 'health',
        impactMetric: 'People supported',
        impactPerPound: '1 person supported per £5',
        logoUrl: 'https://example.com/mind-logo.png',
        website: 'https://www.mind.org.uk',
        isActive: true,
      },
    }),
  ]);

  console.log(`✅ Created ${charities.length} charities`);

  // Create test users
  console.log('Creating test users...');

  const testUser1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
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

  const testUser2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      phone: '+447700900002',
      firstName: 'Bob',
      lastName: 'Smith',
      timezone: 'Europe/London',
      subscriptionTier: 'ELITE',
      subscriptionStatus: 'active',
      track: 'meditation',
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

  const testUser3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      phone: '+447700900003',
      firstName: 'Charlie',
      lastName: 'Davis',
      timezone: 'Europe/London',
      subscriptionTier: 'FREE',
      subscriptionStatus: 'active',
      track: 'reading',
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

  // Create Impact Wallets for test users
  console.log('Creating Impact Wallets...');

  await Promise.all([
    prisma.impactWallet.upsert({
      where: { userId: testUser1.id },
      update: {},
      create: {
        userId: testUser1.id,
        monthlyLimit: 20,
        dailyCap: 3,
        currentMonthSpent: 5.5,
        monthStartDate: new Date(),
        lifetimeDonated: 45.75,
      },
    }),
    prisma.impactWallet.upsert({
      where: { userId: testUser2.id },
      update: {},
      create: {
        userId: testUser2.id,
        monthlyLimit: 30,
        dailyCap: 4,
        currentMonthSpent: 12.0,
        monthStartDate: new Date(),
        lifetimeDonated: 98.50,
      },
    }),
    prisma.impactWallet.upsert({
      where: { userId: testUser3.id },
      update: {},
      create: {
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
    prisma.streak.upsert({
      where: { userId: testUser1.id },
      update: {},
      create: {
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
    prisma.streak.upsert({
      where: { userId: testUser2.id },
      update: {},
      create: {
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
    prisma.streak.upsert({
      where: { userId: testUser3.id },
      update: {},
      create: {
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

  const testCompany = await prisma.company.upsert({
    where: { name: 'Acme Corp' },
    update: {},
    create: {
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
