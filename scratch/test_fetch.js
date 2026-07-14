const URL = "https://kymoxuucjfgotjlhkfua.supabase.co/functions/v1/enrollment-data?action=search-athletes&q=jacopo";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bW94dXVjamZnb3RqbGhrZnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4ODI4NTEsImV4cCI6MjA4NjQ1ODg1MX0.QT6exncW3QI2SjJFOZJKyP8kRj87lLYBrNydqXSNRBc";

fetch(URL, {
  headers: {
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${ANON_KEY}`
  }
})
.then(async res => {
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Response text:", text);
})
.catch(err => console.error("Error:", err));
