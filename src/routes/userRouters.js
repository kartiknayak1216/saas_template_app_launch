import express from 'express';
import { setupNewUser, getUserDetails, deleteUser } from '../controllers/user/create.js';
import { getAllPlans, seedPlans } from '../controllers/plans/create.js';
import {
  subscribeToPlan,
  adminSubscribeToPlan,
  cancelSubscription,
  deductCredits,
  getCreditStatus,
  runDailyCron,
  canDeductCredit,
  getCreditSummary,
} from '../controllers/subscription/index.js';
import { uploadImage } from '../controllers/image/upload.js';

const router = express.Router();

// User Management Routes
router.post('/setupUser', setupNewUser);
router.get('/userDetails', getUserDetails);
router.delete('/deleteUser', deleteUser);

// Plan Routes
router.get('/getPlan', getAllPlans);
router.post('/seed-plans', seedPlans);

// Subscription and Credits
router.post('/subscribe', subscribeToPlan);
router.post('/admin/subscribe', adminSubscribeToPlan);
router.post('/cancel-subscription', cancelSubscription);
router.post('/deduct-credits', deductCredits);
router.get('/credits', getCreditStatus);
router.post('/can-deduct-credit', canDeductCredit);
router.get('/credit-summary', getCreditSummary);

// Cron-like endpoint to be called once per day
router.post('/cron/daily-reset', runDailyCron);

// Image Upload
router.post('/upload-image', uploadImage);

export default router;
