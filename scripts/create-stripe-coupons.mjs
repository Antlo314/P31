// scripts/create-stripe-coupons.mjs
// Creates the enrollment coupon codes and customer promotion codes in Stripe via the Stripe API.
//
// Usage:
//   node scripts/create-stripe-coupons.mjs <STRIPE_SECRET_KEY>
// or
//   set COLLECTIVE_STRIPE_SECRET_KEY=sk_live_... (or STRIPE_SECRET_KEY)
//   node scripts/create-stripe-coupons.mjs

const key = process.argv[2] || process.env.COLLECTIVE_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

if (!key) {
  console.error('\x1b[31mError: Stripe Secret Key not provided.\x1b[0m');
  console.log('\nUsage:');
  console.log('  node scripts/create-stripe-coupons.mjs <sk_live_... or sk_test_...>');
  console.log('or set COLLECTIVE_STRIPE_SECRET_KEY in your environment.');
  process.exit(1);
}

const COUPONS = [
  {
    code: 'GRANTU100',
    name: 'Crisis Start-up',
    percent_off: 100,
    duration: 'repeating',
    duration_in_months: 3,
    description: '100% off for 3 months',
  },
  {
    code: 'STUDENT10',
    name: 'Students',
    percent_off: 10,
    duration: 'forever',
    description: '10% off/month ALL Tiers',
  },
  {
    code: 'GRANTU50',
    name: 'Special',
    amount_off: 5000, // $50 in cents
    currency: 'usd',
    duration: 'repeating',
    duration_in_months: 6,
    description: '$50 off/month for 6 months ALL Tiers',
  },
  {
    code: 'GRANTU20',
    name: 'Member Hardship',
    percent_off: 20,
    duration: 'repeating',
    duration_in_months: 2, // 60 days
    description: '20% off for 60 days (2 months) ALL TIERS',
  },
  {
    code: 'GRANTU30',
    name: 'Mom Hardship',
    percent_off: 30,
    duration: 'repeating',
    duration_in_months: 3, // 90 days
    description: '30% off for 90 days (3 months) ALL TIERS',
  },
  {
    code: 'GRANTU1',
    name: 'New Mentees - 1 Month',
    percent_off: 50,
    duration: 'repeating',
    duration_in_months: 1,
    description: '50% off 1 month ALL TIERS',
  },
  {
    code: 'GRANTU3',
    name: 'New Mentees - 3 Months',
    percent_off: 20,
    duration: 'repeating',
    duration_in_months: 3,
    description: '20% off 3 months ALL TIERS',
  },
  {
    code: 'GRANTU40S',
    name: 'Relative Mentees',
    percent_off: 40,
    duration: 'repeating',
    duration_in_months: 6,
    description: '40% off 6 months ALL TIERS',
  },
];

async function stripeRequest(path, params = null) {
  const url = `https://api.stripe.com/v1${path}`;
  const options = {
    method: params ? 'POST' : 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (params) {
    options.body = new URLSearchParams(params).toString();
  }
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log(`Connecting to Stripe with key (${key.slice(0, 7)}...${key.slice(-4)})...`);
  
  for (const c of COUPONS) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing: [${c.code}] ${c.name} - ${c.description}`);
    
    // 1. Check or create Coupon
    const couponParams = {
      id: c.code,
      name: c.name.slice(0, 40),
      duration: c.duration,
    };
    if (c.percent_off !== undefined) {
      couponParams.percent_off = c.percent_off;
    }
    if (c.amount_off !== undefined) {
      couponParams.amount_off = c.amount_off;
      couponParams.currency = c.currency;
    }
    if (c.duration_in_months !== undefined) {
      couponParams.duration_in_months = c.duration_in_months;
    }

    let couponRes = await stripeRequest('/coupons', couponParams);
    if (!couponRes.ok) {
      if (couponRes.data?.error?.code === 'resource_already_exists') {
        console.log(`  ✓ Coupon "${c.code}" already exists in Stripe.`);
      } else {
        console.error(`  ✗ Failed to create coupon "${c.code}":`, couponRes.data?.error?.message || couponRes.data);
      }
    } else {
      console.log(`  ✓ Successfully created coupon "${c.code}".`);
    }

    // 2. Check or create Promotion Code
    // First query if promotion code with this code string already exists
    const existingPromo = await stripeRequest(`/promotion_codes?code=${encodeURIComponent(c.code)}`);
    if (existingPromo.ok && existingPromo.data?.data?.length > 0) {
      const active = existingPromo.data.data.find(p => p.active);
      if (active) {
        console.log(`  ✓ Promotion code "${c.code}" already active in Stripe.`);
        continue;
      }
    }

    const promoRes = await stripeRequest('/promotion_codes', {
      coupon: c.code,
      code: c.code,
    });

    if (!promoRes.ok) {
      if (promoRes.data?.error?.code === 'resource_already_exists') {
        console.log(`  ✓ Promotion code "${c.code}" already exists.`);
      } else {
        console.error(`  ✗ Failed to create promotion code "${c.code}":`, promoRes.data?.error?.message || promoRes.data);
      }
    } else {
      console.log(`  ✓ Successfully activated promotion code "${c.code}"!`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`Finished processing all ${COUPONS.length} coupon codes.`);
  console.log(`==================================================\n`);
}

run().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
