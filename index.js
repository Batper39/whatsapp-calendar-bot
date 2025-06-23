const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const chrono = require('chrono-node');

// Load environment variables from .env (we'll use this later)
require('dotenv').config();

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(__dirname, 'token.json');

authorizeFromEnv(createTestEvent);

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob'
);
  // Check for existing token
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function authorizeFromEnv(callback) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );

  // Load saved token.json file
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('\n🔐 Authorize this app by visiting this URL:\n', authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('\nPaste the code here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('❌ Error retrieving access token:', err);
      oAuth2Client.setCredentials(token);

      // Save token for future runs
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error('❌ Error saving token:', err);
        console.log('✅ Token saved to', TOKEN_PATH);
      });

      callback(oAuth2Client);
    });
  });
}

function createTestEvent(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: '🚀 WhatsApp Test Event',
    description: 'This event was created by a Node.js script!',
    start: {
      dateTime: '2025-06-23T10:00:00+03:00',
    },
    end: {
      dateTime: '2025-06-23T11:00:00+03:00',
    },
  };

  calendar.events.insert(
    {
      calendarId: 'primary',
      resource: event,
    },
    (err, eventRes) => {
      if (err) {
        console.error('❌ Error creating event:', err);
        return;
      }
      console.log('✅ Event created:', eventRes.data.htmlLink);
    }
  );
}
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Setup WhatsApp client
const waClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox'],
  },
});

// Show QR code in terminal
waClient.on('qr', (qr) => {
  console.log('\n📲 Scan this QR code with WhatsApp Web:\n');
  qrcode.generate(qr, { small: true });
});

// Confirm ready
waClient.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
});

// Message handler
waClient.on('message_create', async (msg) => {
  console.log('📥 Your message:', msg.body);

  const messageText = msg.body;

  if (messageText.toLowerCase().startsWith('event:')) {
    const [, details] = messageText.split(':');

    try {
      const [title, dateTimeStr] = details.split('|').map((s) => s.trim());

      const start = chrono.parseDate(dateTimeStr);

if (!start || isNaN(start.getTime())) {
  msg.reply('❗ Invalid date. Use format: Event: Title | June 27, 15:00');
  return;
}

      const end = new Date(start.getTime() + 60 * 60 * 1000);

      console.log(`📅 Creating event: "${title}" at ${start.toISOString()}`);

      const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials/credentials.json')));
      authorize(creds, (auth) => {
        const calendar = google.calendar({ version: 'v3', auth });

        calendar.events.insert(
          {
            calendarId: 'primary',
            resource: {
              summary: title,
              start: { dateTime: start.toISOString() },
              end: { dateTime: end.toISOString() },
            },
          },
          (err, eventRes) => {
            if (err) {
              console.error('❌ Calendar error:', err);
              msg.reply('😕 Could not create event.');
              return;
            }
            const link = eventRes.data.htmlLink;
            msg.reply(`✅ Event created: ${link}`);
          }
        );
      });
    } catch (err) {
      console.error('❌ Error:', err);
      msg.reply('❗ Could not parse message. Use format: Event: Title | June 27, 15:00');
    }
  }
});

// Start the WhatsApp client
waClient.initialize();
