import { SessionStatus } from "../../../generated/prisma/enums";
import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import httpStatus from "http-status";
import { IAddReviewPayload } from "./review.interface";

export const addReview = async (
  user: IRequestUser,
  payload: IAddReviewPayload
) => {
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
      "Confirmed session not found or unauthorized"
    );
  }

  if (!session.completedSession) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Cannot add review before completing the session"
    );
  }

  if (session.review) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You have already submitted a review for this session"
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

export const ReviewServices = {
    addReview
};
