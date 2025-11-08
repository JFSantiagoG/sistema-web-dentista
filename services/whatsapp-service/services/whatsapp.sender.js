const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID,
  WA_API_VERSION,
} = process.env;

const API_VERSION = WA_API_VERSION || 'v22.0';
const WA_URL = `https://graph.facebook.com/${API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

async function sendToWhatsApp(payload) {
  const fetch = (await import('node-fetch')).default;

  const resp = await fetch(WA_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error('❌ Error WhatsApp:', data);
    throw data;
  }
  return data;
}
