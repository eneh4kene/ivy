# Ivy — Team Documentation Package
## Everything You Need to Build Ivy

---

# 📁 Document Index

| # | Document | Description | Audience |
|---|----------|-------------|----------|
| 01 | **Team Introduction** | What Ivy is, why we're building it, how it works | Everyone |
| 02 | **Technical Spec** | Architecture, database, APIs, integrations | Engineering |
| 03 | **Sprint Plan** | MVP roadmap, milestones, task breakdown | Engineering, Product |
| 04 | **Developer Setup** | From zero to first call guide | Engineering |
| 05 | **API Reference** | Complete endpoint documentation | Engineering |
| 06 | **UX Guidelines** | Voice design, tone, language rules | Engineering, Design |
| 07 | **Testing Guide** | Test strategies, checklists, QA | Engineering, QA |
| 08 | **B2B Product Spec** | Full Sponsor Mode specification | Product, Sales, Engineering |
| 09 | **B2C Product Spec** | Full Premium tier specification | Product, Sales, Engineering |
| 10 | **Retell Prompt (B2B)** | Production AI prompt for Sponsor Mode | Engineering |
| 11 | **Retell Prompt (B2C)** | Production AI prompt for Premium | Engineering |

---

# 🚀 Getting Started

## For Everyone
1. Read **01_ivy_team_introduction.md** first
2. Understand the problem, solution, and business model

## For Engineers
1. Read **01_ivy_team_introduction.md**
2. Read **02_ivy_technical_spec.md** for architecture
3. Follow **04_ivy_developer_setup.md** to get running
4. Review **03_ivy_sprint_plan.md** for your tasks
5. Reference **05_ivy_api_reference.md** during development

## For Product/Design
1. Read **01_ivy_team_introduction.md**
2. Deep dive into **08_ivy_b2b_sponsor_mode_spec.md** or **09_ivy_b2c_premium_spec.md**
3. Study **06_ivy_ux_guidelines.md** for voice/tone

## For QA
1. Read **01_ivy_team_introduction.md**
2. Review **07_ivy_testing_guide.md**
3. Understand flows from product specs

---

# 📋 Quick Reference

## What Is Ivy?
An AI accountability partner that calls you to make sure you do what you said you'd do — and donates to charity every time you follow through.

## Two Products
1. **B2B Sponsor Mode** — Companies pay for employee accountability
2. **B2C Premium** — Individuals pay £99-399/month for high-touch accountability

## Core Tech Stack
- **Voice AI**: Retell AI
- **Telephony**: Twilio
- **Messaging**: WhatsApp Business API
- **Database**: PostgreSQL
- **Cache/Queue**: Redis

## MVP Timeline
- **Week 1-2**: Foundation (Retell working, calls scheduled)
- **Week 3-4**: Reliability (WhatsApp, retry logic, dashboards)
- **Week 5-6**: Enhancement (weekly planning, transformation tracking)

---

# 🔑 Key Principles

## Product Principles
1. **Voice-first** — Calls are the core, everything else supports them
2. **Judgment-free** — Accountability without shame
3. **Meaningful stakes** — Real charity donations, not fake points
4. **Transformation tracking** — Not just "did you do it" but "what's changing"

## Engineering Principles
1. **Reliability first** — Calls must work every time
2. **Graceful degradation** — Handle failures without user impact
3. **Privacy by design** — Especially for B2B (no individual data to employers)
4. **Ship fast, iterate** — Get to pilot quickly, learn from real users

---

# 📞 Need Help?

- **Retell AI docs**: https://docs.retellai.com
- **Twilio docs**: https://www.twilio.com/docs
- **WhatsApp Business API**: https://developers.facebook.com/docs/whatsapp

---

**Let's build something that actually helps people.** 🌱
