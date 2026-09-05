import { Role, SessionStatus } from "../../../generated/prisma/enums";
import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import httpStatus from "http-status";
import { IAddReviewPayload } from "./review.interface";

const addReview = async (user: IRequestUser, payload: IAddReviewPayload) => {
	const { sessionId, ratings, review } = payload;

	await getActiveUserByEmailOrThrow(user.email);

	const session = await prisma.session.findFirst({
		where: {
			sessionId,
			userId: user.userId,
			status: SessionStatus.COMFIRMED,
		},
		include: {
			review: true,
		},
	});

	if (!session) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Confirmed session not found or unauthorized",
		);
	}

	if (!session.completedSession) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Cannot add review before completing the session",
		);
	}

	if (session.review) {
		throw new AppError(
			httpStatus.CONFLICT,
			"You have already submitted a review for this session",
		);
	}

	return await prisma.$transaction(async (tx) => {
		const addedReview = await tx.review.create({
			data: {
				sessionId,
				mentorId: session.mentorId,
				ratings: ratings,
				comment: review,
			},
		});

		const reviewsAggregate = await tx.review.aggregate({
			where: {
				mentorId: session.mentorId,
			},
			_avg: {
				ratings: true,
			},
			_count: {
				reviewId: true,
			},
		});

		const newAverage = Number((reviewsAggregate._avg.ratings || 0).toFixed(2));
		const newTotalReviews = reviewsAggregate._count.reviewId;

		await tx.mentor.update({
			where: {
				mentorId: session.mentorId,
			},
			data: {
				averageRatings: newAverage,
				totalReviews: newTotalReviews,
			},
		});

		return addedReview;
	});
};

const homepageReviews = async () => {
	const reviews = await prisma.review.findMany({
		select: {
			session: {
				select: {
					user: {
						select: {
							name: true,
							profileURL: true,
						},
					},
				},
			},
			ratings: true,
			comment: true,
		},
		orderBy: { ratings: "desc" },
		take: 8,
	});

	return reviews;
};

const myReviewsUser = async (user: IRequestUser) => {
	const reviews = await prisma.review.findMany({
		where: {
			session: {
				userId: user.userId,
			},
		},
		include: {
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							profileURL: true,
						},
					},
				},
			},
			session: {
				select: {
					sessionId: true,
					sessionDate: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return reviews;
};

export const myReviewsMentor = async (user: IRequestUser) => {
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

	const reviews = await prisma.review.findMany({
		where: {
			mentorId: user.userId,
		},
		include: {
			session: {
				select: {
					sessionId: true,
					sessionDate: true,
					user: {
						select: {
							name: true,
							profileURL: true,
						},
					},
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return reviews;
};

export const getAllReviewsAdmin = async (user: IRequestUser) => {
	const admin = await prisma.user.findFirst({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (admin?.role === "MENTOR" || admin?.role === "USER") {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const reviews = await prisma.review.findMany({
		include: {
			session: {
				select: {
					sessionId: true,
					sessionDate: true,
					user: {
						select: {
							userId: true,
							name: true,
							email: true,
						},
					},
				},
			},
			mentor: {
				select: {
					mentorId: true,
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return reviews;
};

export const ReviewServices = {
	addReview,
	homepageReviews,
	myReviewsUser,
	myReviewsMentor,
	getAllReviewsAdmin,
};
