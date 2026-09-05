import { Role } from "../../../generated/prisma/enums";
import { calculatePagination } from "../../../helper/paginationHelper";
import { buildPrismaWhereConditions } from "../../../helper/queryBuilder";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import httpStatus from "http-status";

const getMyPayments = async (user: IRequestUser) => {
	const validUser = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			role: Role.USER,
			isDeleted: false,
		},
	});

	if (!validUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const myPayments = await prisma.payment.findMany({
		where: {
			session: {
				userId: user.userId,
			},
		},
		orderBy: {
			createdAt: "desc",
		},
		select: {
			paymentId: true,
			amount: true,
			paidAt: true,
			status: true,
			session: {
				select: {
					mentor: {
						select: {
							user: {
								select: {
									name: true,
									profileURL: true,
								},
							},
						},
					},
					sessionDate: true,
					startUTC: true,
					endUTC: true,
				},
			},
		},
	});

	return myPayments;
};

const getMyPaymentDetails = async (user: IRequestUser, paymentId: string) => {
	const validUser = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			role: Role.USER,
			isDeleted: false,
		},
	});

	if (!validUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const paymentDetails = await prisma.payment.findUnique({
		where: {
			paymentId,
		},
		select: {
			paymentId: true,
			transactionId: true,
			bkashPaymentId: true,
			bkashTrxId: true,
			payerReference: true,
			refundAmount: true,
			refundReason: true,
			refundedAt: true,
			amount: true,
			paidAt: true,
			status: true,
			session: {
				select: {
					mentor: {
						select: {
							user: {
								select: {
									name: true,
									profileURL: true,
								},
							},
						},
					},
					sessionDate: true,
					startUTC: true,
					endUTC: true,
				},
			},
		},
	});

	return paymentDetails;
};

const getAllPayments = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

	const searchOn = ["session.user.email"];
	const filterBy = ["status"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
		filterableFields: filterBy,
	});

	const isAdmin = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (isAdmin && (isAdmin?.role === "MENTOR" || isAdmin?.role === "USER")) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const [allPayments, total] = await Promise.all([
		prisma.payment.findMany({
			where: whereConditions,

			select: {
				paymentId: true,
				amount: true,
				paidAt: true,
				status: true,
				platformCharge: true,
				mentorEarnings: true,
				session: {
					select: {
						mentor: {
							select: {
								user: {
									select: {
										name: true,
										profileURL: true,
									},
								},
							},
						},
						sessionDate: true,
						startUTC: true,
						endUTC: true,
					},
				},
			},
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
		}),

		prisma.payment.count({
			where: whereConditions,
		}),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: allPayments,
	};
};

const getPaymentDetailsAdmin = async (
	user: IRequestUser,
	paymentId: string,
) => {
	const isAdmin = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (isAdmin && (isAdmin?.role === "MENTOR" || isAdmin?.role === "USER")) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const paymentDetails = await prisma.payment.findUnique({
		where: {
			paymentId,
		},
		select: {
			paymentId: true,
			transactionId: true,
			bkashPaymentId: true,
			bkashTrxId: true,
			payerReference: true,
			refundAmount: true,
			refundReason: true,
			refundedAt: true,
			amount: true,
			paidAt: true,
			status: true,
			platformCharge: true,
			mentorEarnings: true,
			session: {
				select: {
					mentor: {
						select: {
							user: {
								select: {
									name: true,
									profileURL: true,
								},
							},
						},
					},
					sessionDate: true,
					startUTC: true,
					endUTC: true,
				},
			},
		},
	});

	return paymentDetails;
};

export const paymentServices = {
	getMyPayments,
	getMyPaymentDetails,
	getAllPayments,
	getPaymentDetailsAdmin,
};
