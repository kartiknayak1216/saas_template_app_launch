## FaceGPT API – Simple Plans & Credits

Base URL: `/api/user`

### 1. Seed Plans (run once)
- **Method**: POST  
- **URL**: `/seed-plans`  
- **Body**: _none_  
- **Description**: Creates 4 plans in DB: Free (2 credits, no refresh), Starter (weekly, 5 credits), Premium (monthly, 750 credits, 25/day), Business (monthly, 2500 credits).

---

### 2. Setup User (create if not exists, attach Free Plan)
- **Method**: POST  
- **URL**: `/setupUser`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required",
  "email": "user@example.com",
  "name": "Optional Name",
  "referredById": "optional-referral-code"
}
```  
- **Response (201)**: user data, referralStats (with your referral code), and Free-plan subscription.

---

### 3. Get User Details
- **Method**: GET  
- **URL**: `/userDetails?clerkUserId=USER_ID`  
- **Description**: Returns user info, active plan, credits left, total credits used, referral earnings, referrals, billing history.

---

### 4. Get Plans (for frontend)
- **Method**: GET  
- **URL**: `/getPlan`  
- **Description**: Returns all plans with fields: `id`, `name`, `billingCycle`, `price`, `creditsPerPeriod`, `dailyLimit`, `features`.

---

### 5. Subscribe / Change Plan (called after payment on frontend)
- **Method**: POST  
- **URL**: `/subscribe`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required",
  "planId": "plan-id-from-getPlan"
}
```  
- **Description**: Cancels old active subscription, creates new one, resets credits for that plan and adds simple billing history. If user has referrer, adds 20% of plan price to referrer earnings.

---

### 6. Cancel Subscription (back to Free Plan)
- **Method**: POST  
- **URL**: `/cancel-subscription`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required"
}
```  
- **Description**: Cancels active plan and moves user to Free Plan with 2 credits total.

---

### 7. Admin Subscribe User to Plan
- **Method**: POST  
- **URL**: `/admin/subscribe`  
- **Body (JSON)** (use either `userEmail` or `userId`):
```json
{
  "userEmail": "user@example.com",
  "userId": "optional-internal-id",
  "planId": "plan-id-from-getPlan"
}
```  
- **Description**: Directly puts user on the given plan and logs a billing record; also gives referrer 20% of price if exists.

---

### 8. Deduct Credits (use when user makes a search)
- **Method**: POST  
- **URL**: `/deduct-credits`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required",
  "amount": 1
}
```  
- **Description**: Decreases remaining credits on current subscription and logs usage.  
- **Errors (400)**:
  - Not enough credits  
  - Daily limit reached (for plans with daily limit like Premium)

---

### 9. Check Credit Status (is credit available)
- **Method**: GET  
- **URL**: `/credits?clerkUserId=USER_ID`  
- **Response (200)**:
```json
{
  "success": true,
  "data": {
    "planName": "Premium Plan",
    "billingCycle": "monthly",
    "usedToday": 3,
    "dailyLimit": 25,
    "dailyRemaining": 22,
    "usedThisPeriod": 10,
    "periodTotal": 750,
    "periodRemaining": 740
  }
}
```  
- **Description**: Tells how much used today, how much can still use today, total/month or week, and remaining credits.

---

### 10. Daily Cron – Refresh Weekly/Monthly Plans
- **Method**: POST  
- **URL**: `/cron/daily-reset`  
- **Body**: _none_  
- **Description**: Call this once per day (via cron/worker). It:
  - Finds subscriptions where `endDate` has passed,
  - Resets `remainingCredits` to plan `creditsPerPeriod`,
  - Extends `endDate` by 1 week or 1 month,
  - Creates billing history and adds 20% earnings to referrer.

---

### 11. Delete User
- **Method**: DELETE  
- **URL**: `/deleteUser`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required"
}
```  
- **Description**: Deletes user and all related data (subscriptions, credits, referrals, billing history).

---

### 12. Can Deduct Credit (check if credit can be deducted)
- **Method**: POST  
- **URL**: `/can-deduct-credit`  
- **Body (JSON)**:
```json
{
  "clerkUserId": "string-required",
  "amount": 1
}
```  
- **Response (200)**:
```json
{
  "success": true,
  "canDeduct": true,
  "message": "Credit can be deducted",
  "remainingCredits": 740
}
```
- **Description**: Checks if user can deduct the specified amount of credits. Returns `true` or `false` in `canDeduct` field. Checks both remaining credits and daily limit (if applicable).

---

### 13. Get Credit Summary (daily and total remaining)
- **Method**: GET  
- **URL**: `/credit-summary?clerkUserId=USER_ID`  
- **Response (200)**:
```json
{
  "success": true,
  "message": "Credit summary fetched successfully",
  "data": {
    "totalCredit": 750,
    "totalRemaining": 740,
    "dailyCredit": 25,
    "dailyRemaining": 22,
    "usedToday": 3,
    "isDaily": true
  }
}
```
- **Description**: Returns a simple summary showing total credit, total remaining, daily credit limit, daily remaining, how much was used today, and `isDaily` (true if plan has daily limit, false otherwise).

---

### 14. Upload Image (base64 to imgbb)
- **Method**: POST  
- **URL**: `/upload-image`  
- **Body (JSON)**:
```json
{
  "image": "base64-encoded-image-string",
  "email": "user@example.com",
  "username": "optional-username",
  "referCode": "optional-referral-code"
}
```  
- **Response (200)**:
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "url": "https://i.ibb.co/xxxxx/image.jpg",
    "deleteUrl": "https://ibb.co/xxxxx/delete"
  }
}
```
- **Description**: 
  - Accepts base64 encoded image (with or without data URL prefix)
  - Uploads image to imgbb.com
  - Returns the uploaded image URL
  - Sends Telegram notification in background (non-blocking) with image URL, user email (if provided), and refer code (if provided)
  - Telegram notification format: "Image Uploaded by FaceGPT App" with URL, email, and refer code
- **Environment Variables Required**:
  - `IMGBB_API_KEY`: Your imgbb.com API key
  - `TELEGRAM_BOT_TOKEN`: Telegram bot token (optional, for notifications)
  - `TELEGRAM_CHAT_ID`: Telegram chat/group ID (optional, for notifications)
- **Errors (400)**: Invalid base64 format, missing image
- **Errors (500)**: imgbb upload failed, service not configured


