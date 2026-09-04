import {
	PaymentStatus,
	Role,
	SessionStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import httpStatus from "http-status";

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

	const totalSessionHours = Number(
		(totalMilliseconds / (1000 * 60 * 60)).toFixed(1),
	);

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
			orderBy: [{ sessionDate: "asc" }, { startUTC: "asc" }],
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

export const getMentorDashboardAnalytics = async (user: IRequestUser) => {
	const mentor = await prisma.mentor.findFirst({
		where: {
			mentorId: user.userId,
			isDeleted: false,
			user: {
				role: Role.MENTOR,
				isDeleted: false,
			},
		},
	});

	if (!mentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found");
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const [
		totalConfirmedSessions,
		completedSessions,
		upcomingSessionsCount,
		earningsAggregate,
		reviewsAggregate,
		nextUpcomingSession,
	] = await Promise.all([
		prisma.session.count({
			where: {
				mentorId: user.userId,
				status: SessionStatus.COMFIRMED,
			},
		}),

		prisma.session.findMany({
			where: {
				mentorId: user.userId,
				status: SessionStatus.COMFIRMED,
				completedSession: true,
			},
			select: {
				startUTC: true,
				endUTC: true,
			},
		}),

		prisma.session.count({
			where: {
				mentorId: user.userId,
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
					mentorId: user.userId,
				},
				status: PaymentStatus.PAID,
			},
			_sum: {
				mentorEarnings: true,
			},
		}),

		prisma.review.aggregate({
			where: {
				session: {
					mentorId: user.userId,
				},
			},
			_avg: {
				ratings: true,
			},
			_count: {
				reviewId: true,
			},
		}),

		prisma.session.findFirst({
			where: {
				mentorId: user.userId,
				status: SessionStatus.COMFIRMED,
				completedSession: false,
				sessionDate: {
					gte: today,
				},
			},
			orderBy: [{ sessionDate: "asc" }, { startUTC: "asc" }],
			select: {
				sessionId: true,
				sessionDate: true,
				startUTC: true,
				endUTC: true,
				meetingLink: true,
				purpose: true,
				user: {
					select: {
						name: true,
						email: true,
						profileURL: true,
					},
				},
			},
		}),
	]);

	const totalMilliseconds = completedSessions.reduce((acc, session) => {
		const start = new Date(session.startUTC).getTime();
		const end = new Date(session.endUTC).getTime();
		return acc + Math.max(0, end - start);
	}, 0);

	const totalMentoringHours = Number(
		(totalMilliseconds / (1000 * 60 * 60)).toFixed(1),
	);

	return {
		totalSessions: totalConfirmedSessions,
		completedSessions: completedSessions.length,
		upcomingSessions: upcomingSessionsCount,
		totalMentoringHours,
		totalEarnings: Number(earningsAggregate._sum.mentorEarnings || 0),
		averageRating: Number((reviewsAggregate._avg.ratings || 0).toFixed(1)),
		totalReviews: reviewsAggregate._count.reviewId,
		nextSession: nextUpcomingSession
			? {
					sessionId: nextUpcomingSession.sessionId,
					userName: nextUpcomingSession.user.name,
					userEmail: nextUpcomingSession.user.email,
					userProfileURL: nextUpcomingSession.user.profileURL,
					purpose: nextUpcomingSession.purpose,
					date: nextUpcomingSession.sessionDate.toISOString().split("T")[0],
					startTime: nextUpcomingSession.startUTC.toISOString(),
					endTime: nextUpcomingSession.endUTC.toISOString(),
					meetingLink: nextUpcomingSession.meetingLink,
				}
			: null,
	};
};

export const getAdminDashboardAnalytics = async (user: IRequestUser) => {
	const isAdmin = await prisma.user.findFirst({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (isAdmin && (isAdmin?.role === "MENTOR" || isAdmin?.role === "USER")) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const [
		totalUsers,
		totalMentors,
		totalSessions,
		confirmedSessions,
		completedSessions,
		cancelledSessions,
		paymentAggregates,
		reviewsAggregate,
		recentSessions,
	] = await Promise.all([
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

		prisma.session.count(),

		prisma.session.count({
			where: {
				status: SessionStatus.COMFIRMED,
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

		prisma.session.count({
			where: {
				status: SessionStatus.CANCELLED,
			},
		}),

		prisma.payment.aggregate({
			where: {
				status: PaymentStatus.PAID,
			},
			_sum: {
				amount: true,
				platformCharge: true,
				mentorEarnings: true,
			},
		}),

		prisma.review.aggregate({
			_avg: {
				ratings: true,
			},
			_count: {
				reviewId: true,
			},
		}),

		prisma.session.findMany({
			take: 5,
			orderBy: {
				createdAt: "desc",
			},
			select: {
				sessionId: true,
				sessionDate: true,
				status: true,
				sessionFees: true,
				user: {
					select: {
						name: true,
						email: true,
					},
				},
				mentor: {
					select: {
						user: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		}),
	]);

	const totalMilliseconds = completedSessions.reduce((acc, session) => {
		const start = new Date(session.startUTC).getTime();
		const end = new Date(session.endUTC).getTime();
		return acc + Math.max(0, end - start);
	}, 0);

	const totalMentoringHours = Number(
		(totalMilliseconds / (1000 * 60 * 60)).toFixed(1),
	);

	return {
		users: {
			totalUsers,
			totalMentors,
		},
		sessions: {
			totalSessions,
			confirmedSessions,
			completedSessions: completedSessions.length,
			cancelledSessions,
			totalMentoringHours,
		},
		financials: {
			totalRevenue: Number(paymentAggregates._sum.amount || 0),
			platformEarnings: Number(paymentAggregates._sum.platformCharge || 0),
			mentorPayouts: Number(paymentAggregates._sum.mentorEarnings || 0),
		},
		feedback: {
			averagePlatformRating: Number(
				(reviewsAggregate._avg.ratings || 0).toFixed(1),
			),
			totalReviews: reviewsAggregate._count.reviewId,
		},
		recentActivities: recentSessions.map((session) => ({
			sessionId: session.sessionId,
			userName: session.user.name,
			userEmail: session.user.email,
			mentorName: session.mentor.user.name,
			sessionDate: session.sessionDate.toISOString().split("T")[0],
			status: session.status,
			sessionFees: Number(session.sessionFees),
		})),
	};
};

export const AnalyticsServices = {
	getPlatformAnalytics,
	getUserDashboardAnalytics,
	getMentorDashboardAnalytics,
	getAdminDashboardAnalytics,
};
