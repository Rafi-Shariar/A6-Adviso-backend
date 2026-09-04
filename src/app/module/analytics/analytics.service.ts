
import { PaymentStatus, Role, SessionStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import httpStatus from "http-status"

export const getPlatformAnalytics = async () => {
  const [totalUsers, totalMentors, completedSessions] = await Promise.all([
    prisma.user.count({
      where: {
        role: Role.USER,
        isDeleted: false,
      },
    }),
    prisma.mentor.count({
      where: {
        isDeleted: false,
        user: {
          role: Role.MENTOR,
          isDeleted: false,
        },
      },
    }),
    prisma.session.findMany({
      where: {
        completedSession: true,
      },
      select: {
        startUTC: true,
        endUTC: true,
      },
    }),
  ]);

  const totalMilliseconds = completedSessions.reduce((acc, session) => {
    const start = new Date(session.startUTC).getTime();
    const end = new Date(session.endUTC).getTime();
    return acc + Math.max(0, end - start);
  }, 0);

  const totalSessionHours = Number((totalMilliseconds / (1000 * 60 * 60)).toFixed(1));

  return {
    totalUsers,
    totalMentors,
    totalSessionHours,
  };
};


export const getUserDashboardAnalytics = async (user: IRequestUser) => {
  const isUserValid = await prisma.user.findFirst({
    where: {
      userId: user.userId,
      isDeleted: false,
      role: Role.USER,
    },
  });

  if (!isUserValid) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalConfirmedSessions,
    totalCompletedSessions,
    upcomingSessionsCount,
    totalSpentAggregate,
    nextUpcomingSession,
    pendingReviewsCount,
  ] = await Promise.all([
    prisma.session.count({
      where: {
        userId: user.userId,
        status: SessionStatus.COMFIRMED,
      },
    }),

    prisma.session.count({
      where: {
        userId: user.userId,
        status: SessionStatus.COMFIRMED,
        completedSession: true,
      },
    }),

    prisma.session.count({
      where: {
        userId: user.userId,
        status: SessionStatus.COMFIRMED,
        completedSession: false,
        sessionDate: {
          gte: today,
        },
      },
    }),

    prisma.payment.aggregate({
      where: {
        session: {
          userId: user.userId,
        },
        status: PaymentStatus.PAID,
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.session.findFirst({
      where: {
        userId: user.userId,
        status: SessionStatus.COMFIRMED,
        completedSession: false,
        sessionDate: {
          gte: today,
        },
      },
      orderBy: [
        { sessionDate: "asc" },
        { startUTC: "asc" },
      ],
      select: {
        sessionId: true,
        sessionDate: true,
        startUTC: true,
        endUTC: true,
        meetingLink: true,
        mentor: {
          select: {
            headline: true,
            user: {
              select: {
                name: true,
                profileURL: true,
              },
            },
          },
        },
      },
    }),

    prisma.session.count({
      where: {
        userId: user.userId,
        status: SessionStatus.COMFIRMED,
        completedSession: true,
        review: null,
      },
    }),
  ]);

  return {
    totalSessions: totalConfirmedSessions,
    completedSessions: totalCompletedSessions,
    upcomingSessions: upcomingSessionsCount,
    totalPayment: Number(totalSpentAggregate._sum.amount || 0),
    pendingReviews: pendingReviewsCount,
    nextSession: nextUpcomingSession
      ? {
          sessionId: nextUpcomingSession.sessionId,
          mentorName: nextUpcomingSession.mentor.user.name,
          mentorProfileURL: nextUpcomingSession.mentor.user.profileURL,
          mentorHeadline: nextUpcomingSession.mentor.headline,
          date: nextUpcomingSession.sessionDate.toISOString().split("T")[0],
          startTime: nextUpcomingSession.startUTC.toISOString(),
          endTime: nextUpcomingSession.endUTC.toISOString(),
          meetingLink: nextUpcomingSession.meetingLink,
        }
      : null,
  };
};

export const AnalyticsServices = {
    getPlatformAnalytics,
    getUserDashboardAnalytics
};
