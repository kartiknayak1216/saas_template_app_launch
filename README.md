## FaceGPT Credits API

Minimal backend for user plans, subscriptions, credits, and referrals (no payment gateway).

### Install & Run

- **Install**:

```bash
npm install
```

- **Prisma DB sync**:

```bash
npm run migrate
```

- **Start server**:

```bash
npm run dev
```

Server runs on `http://localhost:3000` by default.

### Main Concepts

- **Users**: Created via Clerk `clerkUserId` and email. Each user gets:
  - A **Free Plan** subscription (2 total credits, no refresh).
  - A unique **referral code**.
- **Plans** (seeded):
  - Free Plan – 2 total credits, no refresh, no daily limit.
  - Starter Plan – 5 credits/week, no daily limit.
  - Premium Plan – 750 credits/month, 25 per day.
  - Business Plan – 2500 credits/month, no daily limit.
- **Subscriptions**: Track current plan, credits, start/end dates.
- **Credits**:
  - `remainingCredits` on subscription.
  - Daily limit enforced only when plan has `dailyLimit` (Premium).
- **Referrals**:
  - User can sign up with a `referredById` (referral code).
  - Referrer earns **20% of subscription price** on new subscription and every renewal.

### API Endpoints

Full details with request/response examples are in `API_DOCS.md`. Quick list:

- `POST /api/user/seed-plans` – Seed Free/Starter/Premium/Business plans.
- `POST /api/user/setupUser` – Create user + Free plan + referral code.
- `GET /api/user/userDetails` – Full user + plan + referral info.
- `GET /api/user/getPlan` – List all plans for frontend.
- `POST /api/user/subscribe` – User subscribes/changes plan (use after payment).
- `POST /api/user/admin/subscribe` – Admin directly puts user on plan.
- `POST /api/user/cancel-subscription` – Cancel and move to Free plan.
- `POST /api/user/deduct-credits` – Deduct credits when user uses the app.
- `GET /api/user/credits` – Check daily + period credit usage and remaining.
- `POST /api/user/cron/daily-reset` – Daily job to refresh weekly/monthly plans.
- `DELETE /api/user/deleteUser` – Remove user and all related data.
