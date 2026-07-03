// Test Twilio WhatsApp directly
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

console.log('Testing Twilio WhatsApp...');
console.log('Account SID:', accountSid ? `${accountSid.substring(0, 10)}...` : 'NOT SET');
console.log('Auth Token:', authToken ? 'SET (hidden)' : 'NOT SET');
console.log('WhatsApp Number:', whatsappNumber);

if (!accountSid || !authToken || !whatsappNumber) {
  console.error('❌ Missing Twilio credentials!');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

const testNumber = '+41795018285'; // Your number

console.log(`\nSending test message to: ${testNumber}`);

client.messages
  .create({
    from: whatsappNumber,
    to: `whatsapp:${testNumber}`,
    body: '🔔 Test WhatsApp Alert from Portfolio BIG\n\nThis is a test message to verify Twilio integration.',
  })
  .then(message => {
    console.log('✅ Message sent successfully!');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
  })
  .catch(error => {
    console.error('❌ Failed to send message:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('More info:', error.moreInfo);
  });

