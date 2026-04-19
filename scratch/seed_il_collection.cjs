const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xsnhxjttdizljaawpumz.supabase.co';
const supabaseKey = 'sb_publishable_RBJAx7H4ESWRbEsGjU5ugw_BQ-IrLlC';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Seeding IL Collection for Melanie JC...');

  const melanieProfileId = '545b1f22-6780-49a8-a3c6-408812815fb0';

  // 1. Upsert Melanie's Curator Data
  const curatorData = {
    id: melanieProfileId, // Using profile ID as curator ID for consistency
    business_name: 'Incandescent Lily Collection',
    tagline: 'Wellness and body care rooted in purity and divine intention.',
    bio: 'Transforming the beauty industry by creating wellness and body care rooted in purity, purpose, and divine intention. Founded by Melanie Jeffers-Cameron, IL Collection is a sanctuary for self-care.',
    instagram: 'ilcollection__',
    website: 'https://www.nebaministry.org/ilcollection',
    status: 'approved',
    is_early_bird: true,
    location: 'Atlanta, GA'
  };

  const { data: curatorRow, error: cError } = await supabase
    .from('curator_data')
    .upsert(curatorData)
    .select()
    .single();

  if (cError) {
    console.error('Error upserting curator:', cError);
    return;
  }

  const curatorId = curatorRow.id;
  console.log(`Curator Sanctuary ready: ${curatorRow.business_name} (ID: ${curatorId})`);

  // 2. Define Products
  const products = [
    {
      curator_id: curatorId,
      name: 'Enlighten Hydrating Face & Hair Mist',
      price: 42.00,
      description: 'A divine hydrating mist for face and hair, rooted in purity and purpose.',
      image_url: '/src/assets/curators/ilcollection/mist.png',
      external_url: 'https://www.nebaministry.org/product-page/enlighten-hydrating-face-hair-mist'
    },
    {
      curator_id: curatorId,
      name: 'The Soul Glow Hydrating Oil',
      price: 62.00,
      description: 'Hand-crafted organic oil designed to radiate your divine inner glow.',
      image_url: '/src/assets/curators/ilcollection/oil.png',
      external_url: 'https://www.nebaministry.org/product-page/the-soul-glow-hydrating-oil'
    },
    {
      curator_id: curatorId,
      name: 'The IL Collection Set',
      price: 114.00,
      description: 'The complete set for the Proverbs 31 woman of influence.',
      image_url: '/src/assets/curators/ilcollection/set.png',
      external_url: 'https://www.nebaministry.org/product-page/the-il-collection'
    }
  ];

  // 3. Clear existing products for this curator
  await supabase.from('products').delete().eq('curator_id', curatorId);

  // 4. Insert New Products
  const { error: pError } = await supabase.from('products').insert(products);

  if (pError) {
    console.error('Error inserting products:', pError);
  } else {
    console.log('Successfully seeded IL Collection products.');
  }
}

seed();
