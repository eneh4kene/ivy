# Ivy — Testing Guide
## Quality Assurance Documentation

---

# Overview

This document covers testing strategies for Ivy. Given the voice-first nature of the product, testing requires both traditional software testing AND conversation testing.

---

# Testing Levels

```
┌─────────────────────────────────────────────────────────┐
│                    E2E / Integration                     │
│              (Full call flows, real APIs)               │
├─────────────────────────────────────────────────────────┤
│                    API / Service Tests                   │
│           (Endpoint testing, service logic)             │
├─────────────────────────────────────────────────────────┤
│                      Unit Tests                          │
│              (Individual functions/methods)             │
├─────────────────────────────────────────────────────────┤
│                   Conversation Tests                     │
│            (Ivy prompt quality, edge cases)             │
└─────────────────────────────────────────────────────────┘
```

---

# Unit Tests

## What to Unit Test

| Component | Test Cases |
|-----------|------------|
| Streak calculation | Increment, reset, maintain across dates |
| Donation calculation | Per-completion, daily cap, monthly cap, bonuses |
| Schedule generation | Correct times, timezone handling, day filtering |
| Context building | All variables populated correctly |
| Call outcome parsing | Completed, missed, partial, rest day |

## Example Unit Tests

```javascript
// tests/unit/streak.test.js
describe('StreakService', () => {
  
  describe('updateStreak', () => {
    
    it('should increment streak on completion', async () => {
      const user = await createUser({ streak: 5 });
      await logCompletion(user.id);
      
      const streak = await getStreak(user.id);
      expect(streak.current_streak).toBe(6);
    });
    
    it('should reset streak after missed day', async () => {
      const user = await createUser({ 
        streak: 10,
        last_completion: daysAgo(2) 
      });
      
      await updateStreakIfNeeded(user.id);
      
      const streak = await getStreak(user.id);
      expect(streak.current_streak).toBe(0);
    });
    
    it('should maintain streak with same-day completion', async () => {
      const user = await createUser({ 
        streak: 5,
        last_completion: today() 
      });
      
      await logCompletion(user.id);
      
      const streak = await getStreak(user.id);
      expect(streak.current_streak).toBe(5); // Still 5, not 6
    });
    
    it('should update longest streak when surpassed', async () => {
      const user = await createUser({ 
        streak: 10,
        longest_streak: 10 
      });
      
      await logCompletion(user.id);
      
      const streak = await getStreak(user.id);
      expect(streak.longest_streak).toBe(11);
    });
    
  });
  
  describe('streak bonuses', () => {
    
    it('should trigger 7-day bonus on day 7', async () => {
      const user = await createUser({ streak: 6 });
      
      const result = await logCompletion(user.id);
      
      expect(result.streak_bonus).toBe(3.00);
      expect(result.bonus_type).toBe('streak_bonus_7');
    });
    
    it('should not re-trigger bonus in same period', async () => {
      const user = await createUser({ 
        streak: 7,
        last_7_day_bonus: daysAgo(1)
      });
      
      // User broke streak and rebuilt to 7 within same period
      const result = await logCompletion(user.id);
      
      expect(result.streak_bonus).toBeUndefined();
    });
    
  });
  
});
```

```javascript
// tests/unit/donations.test.js
describe('DonationService', () => {
  
  describe('calculateDonation', () => {
    
    it('should donate per_completion amount', async () => {
      const user = await createUser({ 
        tier: 'b2c_elite',
        per_completion: 1.50 
      });
      
      const donation = await calculateDonation(user.id);
      
      expect(donation.amount).toBe(1.50);
    });
    
    it('should respect daily cap', async () => {
      const user = await createUser({ 
        tier: 'b2c_elite',
        per_completion: 1.50,
        daily_cap: 4.00 
      });
      
      // User has already completed 2 workouts today = £3.00
      await logCompletion(user.id);
      await logCompletion(user.id);
      
      // Third completion should only get £1.00 (cap - used)
      const donation = await calculateDonation(user.id);
      
      expect(donation.amount).toBe(1.00);
    });
    
    it('should respect monthly cap', async () => {
      const user = await createUser({ 
        tier: 'b2c_pro',
        monthly_cap: 20.00,
        month_used: 19.50 
      });
      
      const donation = await calculateDonation(user.id);
      
      expect(donation.amount).toBe(0.50);
    });
    
  });
  
});
```

---

# API / Service Tests

## What to Test

| Endpoint | Test Cases |
|----------|------------|
| POST /users | Valid creation, duplicate phone, missing fields |
| GET /users/:id | Found, not found, unauthorized |
| POST /calls/initiate | Success, user not found, Retell error |
| PATCH /workouts/:id | Complete, partial, skip, streak update |
| POST /messages/send | WhatsApp success, failure handling |

## Example API Tests

```javascript
// tests/api/users.test.js
describe('Users API', () => {
  
  describe('POST /api/users', () => {
    
    it('should create user with valid data', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          phone: '+447700900001',
          first_name: 'Test',
          track: 'fitness',
          weekly_goal: 3,
          charity_id: testCharityId
        });
      
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.phone).toBe('+447700900001');
    });
    
    it('should reject duplicate phone', async () => {
      await createUser({ phone: '+447700900002' });
      
      const response = await request(app)
        .post('/api/users')
        .send({
          phone: '+447700900002',
          first_name: 'Test',
          track: 'fitness'
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
    
    it('should reject invalid phone format', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          phone: '07700900003', // Missing +44
          first_name: 'Test',
          track: 'fitness'
        });
      
      expect(response.status).toBe(400);
    });
    
  });
  
  describe('GET /api/users/:id/stats', () => {
    
    it('should return correct stats', async () => {
      const user = await createUserWithHistory({
        workouts: 10,
        streak: 5,
        donated: 15.00
      });
      
      const response = await request(app)
        .get(`/api/users/${user.id}/stats`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.total_workouts).toBe(10);
      expect(response.body.current_streak).toBe(5);
      expect(response.body.impact.total_donated).toBe(15.00);
    });
    
  });
  
});
```

```javascript
// tests/api/calls.test.js
describe('Calls API', () => {
  
  describe('POST /api/calls/initiate', () => {
    
    it('should initiate call and return call ID', async () => {
      const user = await createUser();
      
      // Mock Retell
      mockRetell.createCall.mockResolvedValue({
        call_id: 'retell_123'
      });
      
      const response = await request(app)
        .post('/api/calls/initiate')
        .send({
          user_id: user.id,
          call_type: 'morning_planning'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.retell_call_id).toBe('retell_123');
      expect(response.body.status).toBe('initiating');
    });
    
    it('should handle Retell error gracefully', async () => {
      const user = await createUser();
      
      mockRetell.createCall.mockRejectedValue(new Error('Retell unavailable'));
      
      const response = await request(app)
        .post('/api/calls/initiate')
        .send({
          user_id: user.id,
          call_type: 'morning_planning'
        });
      
      expect(response.status).toBe(503);
      
      // Verify call was logged as failed
      const call = await db.calls.findFirst({ 
        where: { user_id: user.id } 
      });
      expect(call.status).toBe('failed');
    });
    
  });
  
});
```

---

# Integration Tests

## Full Flow Tests

```javascript
// tests/integration/daily-flow.test.js
describe('Daily Accountability Flow', () => {
  
  it('should complete full morning-to-evening flow', async () => {
    // Setup
    const user = await createUser({
      streak: 5,
      weekly_goal: 3,
      workouts_this_week: 2
    });
    
    // 1. Morning call
    const morningCall = await initiateCall(user.id, 'morning_planning');
    
    // Simulate Retell webhook - call ended
    await request(app)
      .post('/webhooks/retell')
      .send({
        event: 'call_ended',
        call_id: morningCall.retell_call_id,
        metadata: { user_id: user.id, call_type: 'morning_planning' },
        transcript: "User said they'll do gym at 6pm"
      });
    
    // Verify workout was created
    const workout = await db.workouts.findFirst({
      where: { user_id: user.id, status: 'planned' }
    });
    expect(workout).toBeDefined();
    
    // 2. Evening call
    const eveningCall = await initiateCall(user.id, 'evening_review');
    
    // Simulate completion
    await request(app)
      .post('/webhooks/retell')
      .send({
        event: 'call_ended',
        call_id: eveningCall.retell_call_id,
        metadata: { user_id: user.id, call_type: 'evening_review' },
        transcript: "User confirmed they completed the workout"
      });
    
    // Verify outcomes
    const updatedUser = await db.users.findById(user.id);
    const streak = await db.streaks.findByUserId(user.id);
    const donation = await db.donations.findFirst({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' }
    });
    
    expect(streak.current_streak).toBe(6);
    expect(donation.amount).toBeGreaterThan(0);
  });
  
});
```

---

# Conversation Testing

## Why This Matters

Unlike traditional software, Ivy's quality depends heavily on conversation quality. Bad prompts = bad user experience even if the code is perfect.

## What to Test

| Scenario | Expected Behavior |
|----------|-------------------|
| Morning planning - clear response | Ivy confirms plan, sets check-in |
| Morning planning - vague response | Ivy asks clarifying questions |
| Evening review - completed | Ivy celebrates, logs donation |
| Evening review - missed | Ivy acknowledges without judgment |
| Rescue - user wants to skip | Ivy validates, offers minimum |
| User is tired | Ivy adjusts tone, offers options |
| User is upset | Ivy acknowledges, doesn't push |
| User mentions crisis | Ivy provides resources, pauses accountability |

## How to Test Conversations

### Manual Testing Protocol

1. **Create test persona** with specific context
2. **Call the test number**
3. **Run through scenario**
4. **Rate the response** (1-5) on:
   - Appropriateness
   - Helpfulness
   - Tone
   - Accuracy

### Test Script Template

```
SCENARIO: Rescue call - user wants to skip
PERSONA: Sarah, 2-week streak, usually upbeat, today very tired

EXPECTED BEHAVIOR:
- Ivy validates the feeling ("I hear you")
- Ivy asks what's making it hard
- Ivy offers minimum option
- Ivy doesn't guilt or push hard
- If user chooses rest, Ivy accepts gracefully

TEST SCRIPT:
1. Initiate rescue call
2. Say: "I really don't want to go to the gym today"
3. When Ivy asks what's wrong, say: "I'm exhausted. Work has been insane."
4. When offered options, say: "I don't know"
5. If pushed toward minimum, say: "Fine, I guess I can walk"

PASS CRITERIA:
□ Ivy validated without judgment
□ Ivy asked about the obstacle
□ Ivy offered minimum (15 min walk)
□ Ivy got verbal commitment
□ Tone was supportive, not pushy
□ Call felt natural, not robotic
```

### Automated Conversation Testing

```javascript
// tests/conversation/rescue.test.js
describe('Rescue Call Conversation', () => {
  
  it('should handle "want to skip" gracefully', async () => {
    const conversation = await simulateConversation({
      user: testUser,
      call_type: 'rescue',
      turns: [
        { user: "I really don't want to work out today" },
        { user: "I'm exhausted from work" },
        { user: "I guess I could walk for 15 minutes" }
      ]
    });
    
    // Check Ivy's responses
    expect(conversation.turns[0].ivy).toMatch(/hear you|understand|real/i);
    expect(conversation.turns[0].ivy).not.toMatch(/disappointed|should|need to/i);
    
    expect(conversation.turns[1].ivy).toMatch(/minimum|smallest|walk/i);
    
    expect(conversation.turns[2].ivy).toMatch(/counts|win|streak/i);
    expect(conversation.turns[2].ivy).toMatch(/text me|done/i);
  });
  
  it('should not guilt-trip on missed workout', async () => {
    const conversation = await simulateConversation({
      user: testUser,
      call_type: 'evening_review',
      turns: [
        { user: "No, I didn't do it" },
        { user: "I just couldn't make myself go" }
      ]
    });
    
    // Ivy should NOT say these things
    const ivyResponses = conversation.turns.map(t => t.ivy).join(' ');
    expect(ivyResponses).not.toMatch(/disappointing|failed|let yourself down/i);
    expect(ivyResponses).not.toMatch(/you promised|you said you would/i);
    
    // Ivy SHOULD say these things
    expect(ivyResponses).toMatch(/happens|no judgment|tomorrow/i);
  });
  
});
```

---

# Testing Checklist by Feature

## User Onboarding
- [ ] Valid signup creates user
- [ ] Duplicate phone rejected
- [ ] All required fields validated
- [ ] First call scheduled after onboarding
- [ ] Impact Wallet created with correct limits

## Call Scheduling
- [ ] Calls scheduled at correct times
- [ ] Timezone handling correct
- [ ] Rest days excluded
- [ ] Paused users don't get calls
- [ ] Traveling users handled correctly

## Morning Planning Call
- [ ] Call connects successfully
- [ ] Ivy asks for plan
- [ ] Plan is captured and stored
- [ ] Workout record created
- [ ] Evening call scheduled
- [ ] Call transcript stored

## Evening Review Call
- [ ] Call connects successfully
- [ ] Ivy asks about planned workout
- [ ] Completion updates workout status
- [ ] Streak incremented on completion
- [ ] Donation logged on completion
- [ ] Miss handled gracefully
- [ ] Partial completion handled

## Rescue Flow
- [ ] Inbound call routed correctly
- [ ] Ivy validates feelings
- [ ] Minimum option offered
- [ ] Verbal commitment requested
- [ ] Follow-up message sent if needed

## WhatsApp
- [ ] Reminders send at correct time
- [ ] Templates render correctly
- [ ] "Done" reply logs completion
- [ ] "Skip" reply logs rest day
- [ ] Delivery status tracked

## Streaks
- [ ] Increments on completion
- [ ] Resets after missed day
- [ ] Maintains over consecutive days
- [ ] Tracks longest streak
- [ ] 7-day bonus triggers
- [ ] 30-day bonus triggers
- [ ] 90-day bonus triggers

## Donations
- [ ] Per-completion amount correct
- [ ] Daily cap enforced
- [ ] Monthly cap enforced
- [ ] Streak bonuses calculated
- [ ] Charity assignment correct
- [ ] B2B company funding correct

## Dashboard
- [ ] Stats display correctly
- [ ] Streak shows current value
- [ ] Donation total accurate
- [ ] Transformation data shown
- [ ] Life markers displayed

## B2B Admin
- [ ] Company dashboard shows aggregates
- [ ] Individual data not exposed
- [ ] Participation rate accurate
- [ ] Total donations accurate
- [ ] Reports generate correctly

---

# Load Testing

## Scenarios

| Scenario | Target |
|----------|--------|
| Concurrent calls | 50 calls at same time |
| Call scheduling spike | 500 users, same 15-min window |
| WhatsApp throughput | 100 messages/minute |
| API requests | 500 requests/minute |

## Tools

- **k6** for API load testing
- **Retell's test mode** for call volume
- **Twilio's test credentials** for staging

## Example k6 Script

```javascript
// tests/load/api.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '5m',
};

export default function() {
  // Get user stats
  const response = http.get('http://localhost:3000/api/users/test-user/stats', {
    headers: { 'Authorization': 'Bearer test-token' }
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  sleep(1);
}
```

---

# Pre-Launch Checklist

## Before Pilot

- [ ] All unit tests passing
- [ ] All API tests passing
- [ ] Manual call testing complete (10+ calls)
- [ ] Error handling tested
- [ ] Retry logic tested
- [ ] WhatsApp templates approved
- [ ] Load test passed
- [ ] Monitoring/alerting set up

## Before Production

- [ ] Security audit complete
- [ ] GDPR compliance verified
- [ ] Penetration testing (if required)
- [ ] Disaster recovery tested
- [ ] Runbook documented
- [ ] On-call rotation set up

---

# Bug Reporting Template

```markdown
## Bug Report

**Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Environment**: Development / Staging / Production

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:


**Actual Behavior**:


**Logs/Screenshots**:


**User Impact**:


**Workaround** (if any):

```

---
