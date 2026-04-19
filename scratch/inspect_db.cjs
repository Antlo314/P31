const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://xsnhxjttdizljaawpumz.supabase.co';
const supabaseKey = 'sb_publishable_RBJAx7H4ESWRbEsGjU5ugw_BQ-IrLlC';
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('curator_data').select('id, business_name');
  if (error) {
    console.error(error);
  } else {
    console.log('Curators in DB:', data);
  }
}

inspect();
