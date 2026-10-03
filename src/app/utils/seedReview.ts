// src/scripts/seedReviews.ts

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";


export const reviewsData = [
  {
    ratings: new Prisma.Decimal(5.0),
    comment:
      "Outstanding session! The mentor helped me restructure our microservice boundaries and spot critical bottleneck patterns in Kafka event streaming. Highly recommended!",
  },
  {
    ratings: new Prisma.Decimal(4.8),
    comment:
      "Very actionable resume audit and interview steering. Received concrete frameworks for approaching distributed system design questions under pressure.",
  },
  {
    ratings: new Prisma.Decimal(4.9),
    comment:
      "Exceeded expectations. We walked through real-world MLOps pipelines, model versioning with DVC, and managing silent concept drift in production.",
  },
  {
    ratings: new Prisma.Decimal(4.7),
    comment:
      "Sharp insights on product discovery and opportunity solution trees. Uncovered vital user flow blindspots before committing our sprint backlog.",
  },
  {
    ratings: new Prisma.Decimal(5.0),
    comment:
      "High-caliber UI/UX guidance. Clear direction on structuring semantic design tokens in Figma so they directly mirror frontend Tailwind variables.",
  },
  {
    ratings: new Prisma.Decimal(4.6),
    comment:
      "Practical strategies for multi-region cloud resilience and zero-downtime canary deployments. Addressed all our Kubernetes ingress questions.",
  },
  {
    ratings: new Prisma.Decimal(4.9),
    comment:
      "Exceptional mentor. Provided tactical advice on leading architectural RFCs and steering senior-to-staff engineering career milestones.",
  },
  {
    ratings: new Prisma.Decimal(4.8),
    comment:
      "In-depth query profiling and PostgreSQL indexing review. Our slow query times dropped significantly after applying the suggested patterns.",
  },
  {
    ratings: new Prisma.Decimal(5.0),
    comment:
      "Incredible pitch deck review and fundraising breakdown. Clear, candid feedback on valuation models and early-stage runway planning.",
  },
  {
    ratings: new Prisma.Decimal(4.5),
    comment:
      "Great discussion on SOC 2 readiness, enterprise security compliance, and mitigating common OWASP top 10 vulnerabilities.",
  },
  {
    ratings: new Prisma.Decimal(4.9),
    comment:
      "Actionable growth marketing framework. Shared data-driven tactics for improving inbound funnels and lowering acquisition costs across paid channels.",
  },
  {
    ratings: new Prisma.Decimal(5.0),
    comment:
      "Life-changing career guidance! Gave me the confidence, negotiation playbook, and mock interview practice needed to land a staff engineer role.",
  },
];

export const seedReviews = async () => {
  try {
    const existingReviewsCount = await prisma.review.count();

    if (existingReviewsCount > 0) {
      console.log("ℹ️ Reviews already exist in DB. Skipping seeding.");
      return;
    }

    console.log("🌱 Seeding 12 Reviews...");

    // Fetch sessions without an existing review (since sessionId is unique)
    const sessions = await prisma.session.findMany({
      where: {
        review: null,
      },
      select: {
        sessionId: true,
        mentorId: true,
      },
      take: reviewsData.length,
    });

    if (sessions.length < reviewsData.length) {
      console.log(
        `⚠️ Need at least ${reviewsData.length} available sessions without reviews, but found ${sessions.length}. Please seed more sessions first.`
      );
      return;
    }

    // Insert reviews mapped to distinct sessions and mentors
    for (let i = 0; i < reviewsData.length; i++) {
      const targetSession = sessions[i];
      const reviewItem = reviewsData[i];

      await prisma.review.create({
        data: {
          sessionId: targetSession.sessionId,
          mentorId: targetSession.mentorId,
          ratings: reviewItem.ratings,
          comment: reviewItem.comment,
        },
      });

      // Mark the session as completed
      await prisma.session.update({
        where: { sessionId: targetSession.sessionId },
        data: { completedSession: true },
      });
    }

    console.log("🚀 Successfully seeded 12 professional reviews!");
  } catch (error) {
    console.error("❌ Error seeding reviews:", error);
  }
};