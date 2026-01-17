# Ivy — Developer Getting Started Guide
## From Zero to First Call

---

# Welcome

This guide will get you from nothing to making your first Ivy call. Follow it step by step.

**Time to complete**: ~2 hours

---

# Prerequisites

Before you start, make sure you have:

- [ ] Node.js 18+ (or Python 3.10+ if using FastAPI)
- [ ] PostgreSQL 14+ (local or cloud)
- [ ] Redis 6+ (local or cloud)
- [ ] Git
- [ ] A code editor (VS Code recommended)
- [ ] A phone that can receive calls (for testing)

---

# Step 1: Get Access to External Services

## 1.1 Retell AI

1. Go to [retellai.com](https://www.retellai.com)
2. Sign up for an account
3. Get your API key from the dashboard
4. Note: You'll need to add a payment method for production calls

```
RETELL_API_KEY=your_api_key_here
```

## 1.2 Twilio

1. Go to [twilio.com](https://www.twilio.com)
2. Create an account
3. Get a UK phone number (+44...)
4. Get your Account SID and Auth Token

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+44xxxxxxxxxx
```

## 1.3 WhatsApp Business API (Can Defer)

This takes 1-2 weeks to get approved. For MVP, you can:
- Skip WhatsApp initially
- Use Twilio SMS as fallback
- Add WhatsApp later

If setting up now:
1. Go to [Meta Business Manager](https://business.facebook.com)
2. Create a WhatsApp Business Account
3. Apply for API access
4. Get Phone Number ID and Access Token

## 1.4 Stripe (Can Defer)

For MVP pilot, you can skip Stripe and do manual tracking. When ready:
1. Go to [stripe.com](https://stripe.com)
2. Create an account
3. Get API keys (use test mode initially)

---

# Step 2: Clone and Setup

## 2.1 Clone the Repository

```bash
git clone [repository-url]
cd ivy
```

## 2.2 Install Dependencies

**Node.js:**
```bash
npm install
```

**Python:**
```bash
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

## 2.3 Environment Variables

Copy the example env file:
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ivy_dev

# Redis
REDIS_URL=redis://localhost:6379

# Retell
RETELL_API_KEY=your_retell_api_key

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+44xxxxxxxxxx

# JWT (generate a random string)
JWT_SECRET=your_random_secret_string_here
```

## 2.4 Database Setup

**Create the database:**
```bash
createdb ivy_dev
```

**Run migrations:**
```bash
npm run db:migrate
# or
python -m alembic upgrade head
```

**Seed initial data (charities, etc.):**
```bash
npm run db:seed
```

## 2.5 Start Redis

**Local:**
```bash
redis-server
```

**Or use Docker:**
```bash
docker run -d -p 6379:6379 redis
```

## 2.6 Start the Server

```bash
npm run dev
# or
python -m uvicorn main:app --reload
```

You should see:
```
🚀 Server running on http://localhost:3000
📞 Ready to make calls
```

---

# Step 3: Create Your First Test User

## 3.1 Using the API

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+44XXXXXXXXXX",
    "first_name": "Test",
    "track": "fitness",
    "weekly_goal": 3,
    "minimum_action": "15 minute walk",
    "gift_frame": "my family",
    "charity_id": "mind-charity-uuid"
  }'
```

Replace `+44XXXXXXXXXX` with your real phone number.

## 3.2 Using the Database Directly

```sql
INSERT INTO users (
  phone, first_name, track, weekly_goal, 
  minimum_action, gift_frame, charity_id,
  morning_window_start, morning_window_end,
  evening_window_start, evening_window_end,
  subscription_type, status
) VALUES (
  '+44XXXXXXXXXX', 'Test', 'fitness', 3,
  '15 minute walk', 'my family', (SELECT id FROM charities LIMIT 1),
  '08:00', '09:00',
  '19:00', '20:00',
  'b2c_pro', 'active'
);
```

---

# Step 4: Create a Retell Agent

## 4.1 Create the Agent

You can do this via the Retell dashboard or API:

```javascript
// scripts/create-agent.js
const Retell = require('retell-sdk');

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

async function createAgent() {
  const agent = await retell.agent.create({
    agent_name: "Ivy Dev",
    voice_id: "eleven_labs_rachel", // or another voice
    language: "en-GB",
    
    // Use Retell's LLM with our prompt
    llm_websocket_url: null,
    response_engine: {
      type: "retell-llm",
      llm_id: null // Will create one
    },
    
    webhook_url: "https://your-ngrok-url.ngrok.io/webhooks/retell"
  });
  
  console.log("Agent created:", agent.agent_id);
  return agent;
}

createAgent();
```

**Note**: For local development, you'll need ngrok to receive webhooks.

## 4.2 Set Up ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start tunnel
ngrok http 3000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and update:
1. Your Retell agent webhook URL
2. Your `.env` file: `APP_URL=https://abc123.ngrok.io`

## 4.3 Create the LLM Configuration

```javascript
// Create LLM with our system prompt
const llm = await retell.llm.create({
  general_prompt: fs.readFileSync('./prompts/ivy_b2c_premium.md', 'utf8'),
  
  // Dynamic variables we'll inject
  general_tools: [],
  
  // Model settings
  model: "gpt-4o",
  temperature: 0.7
});

console.log("LLM created:", llm.llm_id);
```

Update your agent to use this LLM.

---

# Step 5: Make Your First Call

## 5.1 Initiate a Test Call

```bash
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-test-user-uuid",
    "call_type": "morning_planning"
  }'
```

## 5.2 Or Use the Test Script

```javascript
// scripts/test-call.js
const { initiateCall } = require('../src/services/voice');

async function testCall() {
  const userId = process.argv[2] || 'your-test-user-uuid';
  
  console.log('Initiating test call...');
  const call = await initiateCall(userId, 'morning_planning');
  console.log('Call initiated:', call.id);
  console.log('Retell call ID:', call.retell_call_id);
}

testCall();
```

Run it:
```bash
node scripts/test-call.js your-user-id
```

## 5.3 What Should Happen

1. Your phone rings
2. Ivy says: "Morning [Name]. Quick check-in: what's your fitness plan today?"
3. You respond
4. Ivy confirms your plan
5. Call ends
6. Webhook fires
7. Check logs: `Call completed, transcript received`

---

# Step 6: Verify the Webhook

## 6.1 Check the Webhook Handler

```javascript
// src/api/webhooks/retell.js
app.post('/webhooks/retell', async (req, res) => {
  console.log('Retell webhook received:', JSON.stringify(req.body, null, 2));
  
  const event = req.body;
  
  switch (event.event) {
    case 'call_started':
      console.log('Call started:', event.call_id);
      break;
      
    case 'call_ended':
      console.log('Call ended:', event.call_id);
      console.log('Duration:', event.duration_seconds);
      console.log('Transcript:', event.transcript);
      break;
      
    case 'call_analyzed':
      console.log('Analysis:', event.call_analysis);
      break;
  }
  
  res.sendStatus(200);
});
```

## 6.2 Check the Database

After the call:
```sql
SELECT * FROM calls ORDER BY created_at DESC LIMIT 1;
```

You should see:
- `status: 'completed'`
- `transcript: '[the conversation]'`
- `duration_seconds: [number]`

---

# Step 7: Test the Full Flow

## 7.1 Create a Workout from the Call

After a morning planning call, check:
```sql
SELECT * FROM workouts WHERE user_id = 'your-user-id' ORDER BY created_at DESC;
```

## 7.2 Simulate Evening Call

```bash
curl -X POST http://localhost:3000/api/calls/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your-test-user-uuid",
    "call_type": "evening_review"
  }'
```

## 7.3 Check Streak Updated

After logging a completion:
```sql
SELECT * FROM streaks WHERE user_id = 'your-user-id';
```

---

# Troubleshooting

## Call Doesn't Connect

1. Check Twilio phone number is correct
2. Check Retell API key is valid
3. Check user's phone number format (+44...)
4. Check Retell dashboard for errors

## Webhook Not Firing

1. Check ngrok is running
2. Check ngrok URL is set in Retell agent
3. Check server logs for incoming requests
4. Try Retell's webhook test feature

## Database Connection Failed

1. Check PostgreSQL is running
2. Check DATABASE_URL is correct
3. Check database exists: `psql -l`
4. Check migrations ran: `npm run db:migrate:status`

## Ivy Says Wrong Things

1. Check the system prompt is loaded correctly
2. Check dynamic variables are being injected
3. Check the LLM configuration in Retell
4. Review transcript to see what went wrong

---

# Next Steps

Once you have a working call:

1. **Test the evening review flow** — Complete the daily loop
2. **Add WhatsApp** — Set up messaging for nudges
3. **Build scheduling** — Automate call timing
4. **Create dashboard** — Show user their stats

See the Sprint Plan for detailed next steps.

---

# Useful Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Check database
npm run db:studio  # Opens Prisma Studio or pgAdmin

# View logs
npm run logs

# Reset database (careful!)
npm run db:reset

# Generate new migration
npm run db:migrate:create

# Seed test data
npm run db:seed
```

---

# Getting Help

- **Retell AI Docs**: https://docs.retellai.com
- **Twilio Docs**: https://www.twilio.com/docs
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp

---

**You're ready to build!** 🚀
