import { prisma } from "../../lib/prisma.js";

// Seed the four plans (including free) into the database
export const seedPlans = async (req, res) => {
  try {
    await prisma.plan.deleteMany({});

    const plansData = [
      {
        // Free plan: 2 total credits, no refresh, no daily limit
        name: "Free Plan",
        description: "Free plan with 2 total credits and no automatic refresh.",
        features: "2 total credits, no refresh",
        billingCycle: "free",
        price: 0,
        creditsPerPeriod: 2,
        dailyLimit: null,
        isFree: true,
      },
      {
        name: "Starter Plan",
        description: "5 credits per week, no daily limit.",
        features: "5 credits / week, use anytime within the week",
        billingCycle: "weekly",
        price: 4.99,
        creditsPerPeriod: 5,
        dailyLimit: null,
        isFree: false,
      },
      {
        name: "Premium Plan",
        description: "750 credits per month, max 25 per day.",
        features: "750 credits / month, 25 credits / day",
        billingCycle: "monthly",
        price: 19.99,
        creditsPerPeriod: 750,
        dailyLimit: 25,
        isFree: false,
      },
      {
        name: "Business Plan",
        description: "2500 credits per month, no daily limit.",
        features: "2500 credits / month, no daily limit",
        billingCycle: "monthly",
        price: 49.99,
        creditsPerPeriod: 2500,
        dailyLimit: null,
        isFree: false,
      },
    ];

    await prisma.plan.createMany({
      data: plansData,
    });

    return res.status(201).json({
      success: true,
      message: "Plans seeded successfully",
    });
  } catch (error) {
    console.error("Error seeding plans:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while seeding the plans.",
    });
  }
};

// Get all available plans (for frontend to show)
export const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: "asc" },
    });

    return res.status(200).json({
      success: true,
      message: "Plans retrieved successfully",
      plans,
    });
  } catch (error) {
    console.error("Error retrieving plans:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while retrieving plans",
    });
  }
};


