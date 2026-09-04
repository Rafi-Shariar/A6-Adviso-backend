import { Role } from "../../../generated/prisma/enums";
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

const getAllPayments = async (user: IRequestUser) => {
	const isAdmin = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (isAdmin && (isAdmin?.role === "MENTOR" || isAdmin?.role === "USER")) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const allPayments = await prisma.payment.findMany({
		where: {},
		orderBy: {
			createdAt: "desc",
		},
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
	});

	return allPayments;
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
