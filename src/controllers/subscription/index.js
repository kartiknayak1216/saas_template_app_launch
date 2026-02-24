import { prisma } from "../../lib/prisma.js";
import { sendSubscriptionEventToBoss } from "../../lib/telegramNotifier.js";

// Helper to compute end date for a subscription period
const computeEndDate = (billingCycle) => {
  const now = new Date();
  if (billingCycle === "weekly") {
    now.setDate(now.getDate() + 7);
  } else if (billingCycle === "monthly") {
    now.setMonth(now.getMonth() + 1);
  } else {
    // Free or unknown: long-lived period (10 years)
    now.setFullYear(now.getFullYear() + 10);
  }
  return now;
};

// Helper: apply referral earnings (20% of plan price) if user has referrer
const applyReferralEarning = async (user, plan) => {
  if (!user.referredById || !plan || plan.price <= 0) return;

  const referrerStats = await prisma.referralStats.findUnique({
    where: { userId: user.referredById },
  });

  const earning = plan.price * 0.2;

  if (referrerStats) {
    await prisma.referralStats.update({
      where: { userId: user.referredById },
      data: {
        totalPaidSubscribers: { increment: 1 },
        totalEarning: { increment: earning },
      },
    });
  }
};

// User subscribes / updates plan
export const subscribeToPlan = async (req, res) => {
  try {
    const { clerkUserId, planId } = req.body;

    if (!clerkUserId || !planId) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId and planId are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const endDate = computeEndDate(plan.billingCycle);

    const result = await prisma.$transaction(async (tx) => {
      // Cancel any existing active subscription
      await tx.subscription.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "canceled" },
      });

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          billingCycle: plan.billingCycle,
          status: "active",
          startDate: new Date(),
          endDate,
          remainingCredits: plan.creditsPerPeriod,
        },
      });

      // Simple billing history record (no payment gateway)
      if (plan.price > 0) {
        await tx.billingHistory.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: plan.price,
            currency: "usd",
            status: "completed",
            referenceId: `SUB-${subscription.id}-${Date.now()}`,
          },
        });
      }

      return subscription;
    });

    await applyReferralEarning(user, plan);

    sendSubscriptionEventToBoss("subscribe", user.email, user.name, plan.name, plan.price);

    return res.status(200).json({
      success: true,
      message: "Subscription updated successfully",
      subscription: result,
    });
  } catch (error) {
    console.error("Error subscribing to plan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to subscribe to plan",
    });
  }
};

// Admin can directly subscribe a user to a plan using email or internal id
export const adminSubscribeToPlan = async (req, res) => {
  try {
    const { userEmail, userId, planId } = req.body;

    if (!planId || (!userEmail && !userId)) {
      return res.status(400).json({
        success: false,
        message: "planId and either userEmail or userId are required",
      });
    }

    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { email: userEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    const endDate = computeEndDate(plan.billingCycle);

    const result = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "canceled" },
      });

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          billingCycle: plan.billingCycle,
          status: "active",
          startDate: new Date(),
          endDate,
          remainingCredits: plan.creditsPerPeriod,
        },
      });

      if (plan.price > 0) {
        await tx.billingHistory.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: plan.price,
            currency: "usd",
            status: "completed",
            referenceId: `ADMIN-SUB-${subscription.id}-${Date.now()}`,
          },
        });
      }

      return subscription;
    });

    await applyReferralEarning(user, plan);

    return res.status(200).json({
      success: true,
      message: "Admin subscription applied successfully",
      subscription: result,
    });
  } catch (error) {
    console.error("Error in adminSubscribeToPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to subscribe user to plan",
    });
  }
};

// Cancel subscription and move user back to Free Plan
export const cancelSubscription = async (req, res) => {
  try {
    const { clerkUserId } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const freePlan = await prisma.plan.findFirst({
      where: { isFree: true },
    });

    if (!freePlan) {
      return res.status(500).json({
        success: false,
        message: "Free plan is not configured",
      });
    }

    const endDate = computeEndDate("free");

    const result = await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "canceled" },
      });

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          billingCycle: "free",
          status: "active",
          startDate: new Date(),
          endDate,
          remainingCredits: freePlan.creditsPerPeriod,
        },
      });

      return subscription;
    });

    sendSubscriptionEventToBoss("cancel", user.email, user.name, "Free Plan");

    return res.status(200).json({
      success: true,
      message: "Subscription canceled, user moved to Free Plan",
      subscription: result,
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  }
};

// Deduct credits from current subscription
export const deductCredits = async (req, res) => {
  try {
    const { clerkUserId, amount } = req.body;

    const creditsToDeduct = Number(amount);

    if (!clerkUserId || !creditsToDeduct || creditsToDeduct <= 0) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId and positive amount are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found for user",
      });
    }

    if (subscription.remainingCredits < creditsToDeduct) {
      return res.status(400).json({
        success: false,
        message: "Not enough credits",
        remainingCredits: subscription.remainingCredits,
      });
    }

    // Check daily limit if exists
    if (subscription.plan.dailyLimit != null) {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );

      const todayUsage = await prisma.creditUsage.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      });

      const usedToday = todayUsage._sum.amount || 0;
      const allowedToday =
        subscription.plan.dailyLimit - usedToday - creditsToDeduct;

      if (allowedToday < 0) {
        return res.status(400).json({
          success: false,
          message: "Daily credit limit reached for this plan",
          dailyLimit: subscription.plan.dailyLimit,
          usedToday,
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          remainingCredits: { decrement: creditsToDeduct },
        },
      });

      await tx.creditUsage.create({
        data: {
          userId: user.id,
          amount: creditsToDeduct,
          reason: "credit_used",
        },
      });

      return updatedSub;
    });

    return res.status(200).json({
      success: true,
      message: "Credits deducted successfully",
      remainingCredits: updated.remainingCredits,
    });
  } catch (error) {
    console.error("Error deducting credits:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to deduct credits",
    });
  }
};

// Check how many credits were used and are available (day + period)
export const getCreditStatus = async (req, res) => {
  try {
    const { clerkUserId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found for user",
      });
    }

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const dayUsage = await prisma.creditUsage.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const periodUsage = await prisma.creditUsage.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: subscription.startDate },
      },
      _sum: { amount: true },
    });

    const usedToday = dayUsage._sum.amount || 0;
    const usedThisPeriod = periodUsage._sum.amount || 0;
    const periodTotal = subscription.plan.creditsPerPeriod;

    const dailyLimit = subscription.plan.dailyLimit;
    const dailyRemaining =
      dailyLimit != null ? Math.max(dailyLimit - usedToday, 0) : null;

    return res.status(200).json({
      success: true,
      message: "Credit status fetched successfully",
      data: {
        planName: subscription.plan.name,
        billingCycle: subscription.billingCycle,
        usedToday,
        dailyLimit,
        dailyRemaining,
        usedThisPeriod,
        periodTotal,
        periodRemaining: subscription.remainingCredits,
      },
    });
  } catch (error) {
    console.error("Error getting credit status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get credit status",
    });
  }
};

// Cron-like endpoint: called once per day to refresh weekly/monthly plans
export const runDailyCron = async (req, res) => {
  try {
    const now = new Date();

    const expiringSubscriptions = await prisma.subscription.findMany({
      where: {
        status: "active",
        endDate: { lte: now },
      },
      include: {
        plan: true,
        user: true,
      },
    });

    for (const sub of expiringSubscriptions) {
      if (!sub.plan || sub.plan.isFree) {
        continue;
      }

      const newEndDate = computeEndDate(sub.billingCycle);

      await prisma.$transaction(async (tx) => {
        const updatedSub = await tx.subscription.update({
          where: { id: sub.id },
          data: {
            startDate: new Date(),
            endDate: newEndDate,
            remainingCredits: sub.plan.creditsPerPeriod,
          },
        });

        if (sub.plan.price > 0) {
          await tx.billingHistory.create({
            data: {
              userId: sub.userId,
              subscriptionId: updatedSub.id,
              amount: sub.plan.price,
              currency: "usd",
              status: "completed",
              referenceId: `RENEW-${updatedSub.id}-${Date.now()}`,
            },
          });
        }
      });

      await applyReferralEarning(sub.user, sub.plan);
    }

    return res.status(200).json({
      success: true,
      message: "Daily cron processed successfully",
      processedSubscriptions: expiringSubscriptions.length,
    });
  } catch (error) {
    console.error("Error running daily cron:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to run daily cron",
    });
  }
};

// Check if user can deduct a specific amount of credits
export const canDeductCredit = async (req, res) => {
  try {
    const { clerkUserId, amount } = req.body;

    const creditsToDeduct = Number(amount);

    if (!clerkUserId || !creditsToDeduct || creditsToDeduct <= 0) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId and positive amount are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        canDeduct: false,
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(200).json({
        success: true,
        canDeduct: false,
        message: "No active subscription found for user",
      });
    }

    // Check if enough remaining credits
    if (subscription.remainingCredits < creditsToDeduct) {
      return res.status(200).json({
        success: true,
        canDeduct: false,
        message: "Not enough credits",
        remainingCredits: subscription.remainingCredits,
      });
    }

    // Check daily limit if exists
    if (subscription.plan.dailyLimit != null) {
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      );

      const todayUsage = await prisma.creditUsage.aggregate({
        where: {
          userId: user.id,
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      });

      const usedToday = todayUsage._sum.amount || 0;
      const allowedToday =
        subscription.plan.dailyLimit - usedToday - creditsToDeduct;

      if (allowedToday < 0) {
        return res.status(200).json({
          success: true,
          canDeduct: false,
          message: "Daily credit limit reached for this plan",
          dailyLimit: subscription.plan.dailyLimit,
          usedToday,
        });
      }
    }

    return res.status(200).json({
      success: true,
      canDeduct: true,
      message: "Credit can be deducted",
      remainingCredits: subscription.remainingCredits,
    });
  } catch (error) {
    console.error("Error checking if credit can be deducted:", error);
    return res.status(500).json({
      success: false,
      canDeduct: false,
      message: "Failed to check credit deduction",
    });
  }
};

// Get credit summary showing daily and total remaining
export const getCreditSummary = async (req, res) => {
  try {
    const { clerkUserId } = req.query;

    if (!clerkUserId) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.id, status: "active" },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan) {
      return res.status(400).json({
        success: false,
        message: "No active subscription found for user",
      });
    }

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );

    const dayUsage = await prisma.creditUsage.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: startOfDay },
      },
      _sum: { amount: true },
    });

    const usedToday = dayUsage._sum.amount || 0;
    const dailyLimit = subscription.plan.dailyLimit;
    const dailyRemaining =
      dailyLimit != null ? Math.max(dailyLimit - usedToday, 0) : null;
    const totalRemaining = subscription.remainingCredits;
    const isDaily = dailyLimit != null;

    return res.status(200).json({
      success: true,
      message: "Credit summary fetched successfully",
      data: {
        totalCredit: subscription.plan.creditsPerPeriod,
        totalRemaining: totalRemaining,
        dailyCredit: dailyLimit,
        dailyRemaining: dailyRemaining,
        usedToday: usedToday,
        isDaily: isDaily,
      },
    });
  } catch (error) {
    console.error("Error getting credit summary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get credit summary",
    });
  }
};


