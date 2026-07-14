async function run() {
  const coupleId = "30b05bca-31d7-4630-bac2-df515e011082"; 
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient('https://kymoxuucjfgotjlhkfua.supabase.co', process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  
  const { data: couples } = await supabase.from('couples').select('id').limit(1);
  const realCoupleId = couples?.[0]?.id || coupleId;

  console.log("Calling edge function with couple:", realCoupleId);

  const res = await fetch(`https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/enrollment-data?action=competitions&couple_id=${realCoupleId}`, {
    headers: {
      "apikey": process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      "Authorization": `Bearer ${process.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
    }
  });

  const text = await res.text();
  console.log("Response:", res.status, text);
}

run();
