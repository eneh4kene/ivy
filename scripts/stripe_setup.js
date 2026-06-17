// Run with: node scripts/stripe_setup.js
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const products = [
  {
    name: 'Ivy',
    envKey: 'IVY',
    prices: [{ currency: 'gbp', amount: 7000 }, { currency: 'usd', amount: 8900 }],
  },
  {
    name: 'Ivy Plus',
    envKey: 'IVY_PLUS',
    prices: [{ currency: 'gbp', amount: 9900 }, { currency: 'usd', amount: 11900 }],
  },
  {
    name: 'Ivy Concierge',
    envKey: 'IVY_CONCIERGE',
    prices: [{ currency: 'gbp', amount: 14900 }, { currency: 'usd', amount: 17900 }],
  },
  {
    name: 'Ivy B2B Team',
    envKey: 'B2B_TEAM',
    prices: [{ currency: 'gbp', amount: 4500 }, { currency: 'usd', amount: 5500 }],
  },
  {
    name: 'Ivy B2B Champion',
    envKey: 'B2B_CHAMPION',
    prices: [{ currency: 'gbp', amount: 6500 }, { currency: 'usd', amount: 7900 }],
  },
  {
    name: 'Ivy Coach (5 clients)',
    envKey: 'COACH_5',
    prices: [{ currency: 'gbp', amount: 3500 }, { currency: 'usd', amount: 4500 }],
  },
  {
    name: 'Ivy Coach (10 clients)',
    envKey: 'COACH_10',
    prices: [{ currency: 'gbp', amount: 6000 }, { currency: 'usd', amount: 7500 }],
  },
  {
    name: 'Ivy Coach (20 clients)',
    envKey: 'COACH_20',
    prices: [{ currency: 'gbp', amount: 10000 }, { currency: 'usd', amount: 12500 }],
  },
];

async function setup() {
  const railwayVars = [];

  for (const product of products) {
    const p = await stripe.products.create({ name: product.name });

    for (const price of product.prices) {
      const pr = await stripe.prices.create({
        product: p.id,
        unit_amount: price.amount,
        currency: price.currency,
        recurring: { interval: 'month' },
      });

      const envKey = `STRIPE_PRICE_${product.envKey}_${price.currency.toUpperCase()}`;
      railwayVars.push(`${envKey}=${pr.id}`);
      console.log(`✓ ${product.name} ${price.currency.toUpperCase()} → ${pr.id}`);
    }
  }

  console.log('\n--- Railway variables to set ---');
  railwayVars.forEach(v => console.log(v));
}

setup().catch(console.error);
