import { prisma } from "../../lib/prisma.js";

// Setup or fetch a user. On first creation, attach Free Plan with 2 credits.
export const setupNewUser = async (req, res) => {
  try {
    const { clerkUserId, email, name, referredById } = req.body;

    if (!clerkUserId || !email) {
      return res.status(400).json({
        success: false,
        message: "clerkUserId and email are required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { clerkUserId },
      include: { subscriptions: { include: { plan: true } }, referralStats: true },
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        message: "User already exists",
        user: existingUser,
      });
    }

    // Optional referrer using their referral referenceId
    let referrer = null;
    if (referredById) {
      referrer = await prisma.user.findFirst({
        where: { referralStats: { referenceId: referredById } },
      });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: "Invalid referredById",
        });
      }
    }

    const freePlan = await prisma.plan.findFirst({
      where: { isFree: true },
    });

    if (!freePlan) {
      return res.status(500).json({
        success: false,
        message: "Free plan is not configured in the database",
      });
    }

    const generateReferenceId = () =>
      `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          clerkUserId,
          email,
          name: name || "Anonymous",
          referredById: referrer ? referrer.id : null,
        },
      });

      const referralStats = await tx.referralStats.create({
        data: {
          userId: user.id,
          referenceId: generateReferenceId(),
        },
      });

      // If there is a referrer, increment total users signed
      if (referrer) {
        await tx.referralStats.update({
          where: { userId: referrer.id },
          data: {
            totalUsersSigned: { increment: 1 },
          },
        });
      }

      // Attach Free Plan subscription with 2 credits and no refresh
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 10);

      const subscription = await tx.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          billingCycle: freePlan.billingCycle,
          status: "active",
          startDate: new Date(),
          endDate,
          remainingCredits: freePlan.creditsPerPeriod,
        },
      });

      return { user, referralStats, subscription };
    });

    return res.status(201).json({
      success: true,
      message: "User created with Free Plan",
      user: result.user,
      referralStats: result.referralStats,
      subscription: result.subscription,
    });
  } catch (error) {
    console.error("Error setting up new user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while setting up the user",
    });
  }
};

export const deleteUser = async (req, res) => {
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

    const userId = user.id;

    await prisma.$transaction(async (tx) => {
      await tx.billingHistory.deleteMany({ where: { userId } });
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.creditUsage.deleteMany({ where: { userId } });
      await tx.referralStats.deleteMany({ where: { userId } });

      await tx.user.updateMany({
        where: { referredById: userId },
        data: { referredById: null },
      });

      await tx.user.delete({ where: { id: userId } });
    });

    return res.status(200).json({
      success: true,
      message: "User and associated data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while deleting the user",
    });
  }
};

// Detailed user info: plan, credits, referral earnings, etc.
export const getUserDetails = async (req, res) => {
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
      include: {
        referralStats: true,
        subscriptions: {
          include: { plan: true, billingHistory: true },
          orderBy: { startDate: "desc" },
        },
        billingHistory: true,
        referrals: true,
        referredBy: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const activeSubscription = user.subscriptions.find(
      (s) => s.status === "active"
    );

    const totalCreditUsageAgg = await prisma.creditUsage.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    });

    const totalCreditsUsed = totalCreditUsageAgg._sum.amount || 0;

    const responseData = {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      referredById: user.referredById,
      plan: activeSubscription
        ? {
            planId: activeSubscription.planId,
            name: activeSubscription.plan.name,
            billingCycle: activeSubscription.billingCycle,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            remainingCredits: activeSubscription.remainingCredits,
          }
        : null,
      totalCreditsUsed,
      referral: user.referralStats
        ? {
            referenceId: user.referralStats.referenceId,
            totalUsersSigned: user.referralStats.totalUsersSigned,
            totalPaidSubscribers: user.referralStats.totalPaidSubscribers,
            totalEarning: user.referralStats.totalEarning,
            amountDeduct: user.referralStats.amountDeduct,
          }
        : null,
      referrals: user.referrals.map((ref) => ({
        id: ref.id,
        clerkUserId: ref.clerkUserId,
        email: ref.email,
        name: ref.name,
      })),
      referredBy: user.referredBy
        ? {
            id: user.referredBy.id,
            clerkUserId: user.referredBy.clerkUserId,
            email: user.referredBy.email,
            name: user.referredBy.name,
          }
        : null,
      billingHistory: user.billingHistory,
    };

    return res.status(200).json({
      success: true,
      message: "User details retrieved successfully",
      user: responseData,
    });
  } catch (error) {
    console.error("Error retrieving user details:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving the user",
    });
  }
};
