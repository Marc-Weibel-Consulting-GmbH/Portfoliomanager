/**
 * Triggers a manual KiBoom snapshot via the tRPC API endpoint.
 * This populates creditSpreadHY and creditSpreadIG for the first time.
 */
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

async function triggerSnapshot() {
  console.log(`Triggering KiBoom snapshot via ${BASE_URL}...`);
  
  try {
    const res = await fetch(`${BASE_URL}/api/trpc/kiBoom.triggerSnapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    const text = await res.text();
    console.log('Response status:', res.status);
    console.log('Response:', text.substring(0, 500));
    
    if (res.ok) {
      console.log('✅ Snapshot triggered successfully!');
    } else {
      console.error('❌ Snapshot failed');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

triggerSnapshot();
