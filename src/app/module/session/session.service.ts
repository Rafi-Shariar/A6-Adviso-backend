import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { IRequestUser } from "../auth/auth.interface";
import {
	PaymentStatus,
	Role,
	SessionStatus,
} from "../../../generated/prisma/enums";
import {
	IBookSessionPayload,
	ICancelSessionPayload,
	ICompleteSessionPayload,
} from "./session.interface";
import { getBkashIdToken } from "../../lib/bkash";
import config from "../../config";
import { generateSessionInvoicePDF } from "../../../helper/generateInvoicePDF";
import { transporter } from "../../lib/nodemailer";

import { RequestUser } from "../../middleware/checkAuth";

const getMentorAvailableSlots = async (mentorId: string) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const availableSlots = await prisma.slot.findMany({
		where: {
			isBooked: false,
			schedule: {
				mentorId,
				isDeleted: false,
				date: { gte: today },
			},
		},
		orderBy: [{ schedule: { date: "asc" } }, { startTime: "asc" }],
		select: {
			slotId: true,
			startTime: true,
			endTime: true,
			schedule: {
				select: {
					scheduleId: true,
					date: true,
				},
			},
		},
	});

	const result = availableSlots.map((item) => ({
		slotId: item.slotId,
		scheduleId: item.schedule.scheduleId,
		date: item.schedule.date.toISOString().split("T")[0],
		startTime: item.startTime.toISOString(),
		endTime: item.endTime.toISOString(),
	}));

	return result;
};

const bookSession = async (
	slotId: string,
	user: IRequestUser,
	purpose: string,
) => {
	const transactionResult = await prisma.$transaction(
		async (tx) => {
			const isUserExits = await tx.user.findUnique({
				where: {
					userId: user.userId,
					role: Role.USER,
					isDeleted: false,
				},
			});

			if (!isUserExits) {
				throw new AppError(httpStatus.NOT_FOUND, "User does not exists.");
			}

			if (
				isUserExits.accountStatus === "BLOCKED" ||
				isUserExits.accountStatus === "SUSPENDED"
			) {
				throw new AppError(
					httpStatus.UNAUTHORIZED,
					`Your Account is ${isUserExits.accountStatus}. Please contact support`,
				);
			}

			const slot = await tx.slot.findUnique({
				where: { slotId },
				include: {
					schedule: {
						include: {
							mentor: true,
						},
					},
				},
			});

			if (!slot || slot.schedule.isDeleted) {
				throw new AppError(httpStatus.NOT_FOUND, "Slot not found.");
			}

			if (slot.isBooked) {
				throw new AppError(
					httpStatus.CONFLICT,
					"This slot has already been booked by someone else.",
				);
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);

			if (new Date(slot.schedule.date) < today) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					"Cannot book a slot for a past date.",
				);
			}

			//preventing race conditon
			await tx.slot.update({
				where: { slotId },
				data: {
					isBooked: true,
				},
			});

			//creating session
			const session = await tx.session.create({
				data: {
					userId: user.userId,
					mentorId: slot.schedule.mentorId,
					scheduleId: slot.scheduleId,
					slotId: slot.slotId,
					sessionDate: slot.schedule.date,
					sessionFees: slot.schedule.mentor.sessionCharge,
					startUTC: slot.startTime,
					endUTC: slot.endTime,
					purpose: purpose,
					meetingLink: "will be shared by mentor.",
				},
			});

			const bkashIdToken = await getBkashIdToken();

			if (!bkashIdToken) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"No Bkash Access Token Found!",
				);
			}

			const bkashCreatePaymentResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/create`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						Authorization: bkashIdToken,
						"X-App-Key": config.bkash_app_key,
					},
					body: JSON.stringify({
						mode: "0011",
						payerReference: user.email,
						callbackURL: `${config.bkash_callback_url}/session/book/payment/callback`,
						amount: slot.schedule.mentor.sessionCharge,
						currency: "BDT",
						intent: "sale",
						merchantInvoiceNumber: slot.slotId,
					}),
				},
			);

			const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

			if (
				bkashCreatePaymentResult.statusCode !== "0000" ||
				!bkashCreatePaymentResult.bkashURL
			) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					bkashCreatePaymentResult.statusMessage ||
						"bKash checkout URL generation failed.",
				);
			}

			await tx.payment.create({
				data: {
					transactionId: bkashCreatePaymentResult.merchantInvoiceNumber,
					sessionId: session.sessionId,
					amount: slot.schedule.mentor.sessionCharge,
					gatewayResponse: bkashCreatePaymentResult,
					bkashPaymentId: bkashCreatePaymentResult.paymentID,
					payerReference: user.email,
				},
			});

			return {
				paymentURL: bkashCreatePaymentResult.bkashURL,
			};
		},
		{
			maxWait: 5000,
			timeout: 15000,
		},
	);

	return transactionResult;
};

const paySession = async (sessionId: string, user: RequestUser) => {
	await getActiveUserByEmailOrThrow(user.email);

	const session = await prisma.session.findFirst({
		where: {
			sessionId,
			userId: user.userId,
		},
		include: {
			slot: true,
		},
	});

	if (!session) {
		throw new AppError(httpStatus.NOT_FOUND, "Invalid session ID");
	}

	if (session.status === "COMFIRMED" || session.status === "CANCELLED") {
		throw new AppError(
			httpStatus.CONFLICT,
			`The session is already ${session.status}. Can't Pay.`,
		);
	}

	if (!session.slot || !session.slot.isBooked) {
		throw new AppError(
			httpStatus.REQUEST_TIMEOUT,
			"Reservation timeout or slot released. Please book the session again to pay.",
		);
	}

	const amount = session.sessionFees.toString();
	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
	}

	const bkashCreatePaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				payerReference: user.email,
				callbackURL: `${config.bkash_callback_url}/session/book/payment/callback`,
				amount: amount,
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: session.sessionId,
			}),
		},
	);

	const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json();

	if (
		bkashCreatePaymentResult.statusCode !== "0000" ||
		!bkashCreatePaymentResult.bkashURL
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			bkashCreatePaymentResult.statusMessage ||
				"bKash checkout URL generation failed.",
		);
	}

	await prisma.payment.update({
		where: {
			sessionId: sessionId,
		},
		data: {
			gatewayResponse: bkashCreatePaymentResult,
			bkashPaymentId: bkashCreatePaymentResult.paymentID,
		},
	});

	return {
		paymentURL: bkashCreatePaymentResult.bkashURL,
	};
};

const bookSessionCallback = async (query: Record<string, any>) => {
	const { paymentID, status } = query;

	if (!paymentID) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment ID is missing");
	}

	if (!status) {
		throw new AppError(httpStatus.BAD_REQUEST, "Payment status is missing");
	}

	if (status === "cancel" || status === "failure") {
		await prisma.$transaction(async (tx) => {
			const payment = await tx.payment.findFirst({
				where: { bkashPaymentId: paymentID },
				include: { session: true },
			});

			if (payment) {
				await tx.payment.update({
					where: { paymentId: payment.paymentId },
					data: {
						status: PaymentStatus.FAILED,
					},
				});
			}
		});

		return {
			redirectURL: `${config.frontend_url}/dashboard/my-sessions?status=${status}`,
		};
	}

	const bkashIdToken = await getBkashIdToken();

	if (!bkashIdToken) {
		throw new AppError(httpStatus.BAD_GATEWAY, "No Bkash Access Token Found!");
	}

	const executedPaymentResponse = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: bkashIdToken,
				"X-App-Key": config.bkash_app_key,
			},
			body: JSON.stringify({ paymentID }),
		},
	);

	const executedPaymentResult = await executedPaymentResponse.json();

	if (
		executedPaymentResult.statusCode !== "0000" ||
		!executedPaymentResult.trxID
	) {
		await prisma.$transaction(async (tx) => {
			const payment = await tx.payment.findFirst({
				where: { bkashPaymentId: paymentID },
				include: { session: true },
			});

			if (payment) {
				await tx.payment.update({
					where: { paymentId: payment.paymentId },
					data: {
						status: PaymentStatus.FAILED,
						gatewayResponse: executedPaymentResult,
					},
				});
			}
		});

		return {
			redirectURL: `${config.frontend_url}/dashboard/my-sessions?status=failed`,
		};
	}

	let invoiceMailData: any = null;

	await prisma.$transaction(
		async (tx) => {
			const payment = await tx.payment.findFirst({
				where: { bkashPaymentId: paymentID },
				include: {
					session: {
						include: {
							mentor: { include: { user: true } },
							slot: { include: { schedule: true } },
							user: true,
						},
					},
				},
			});

			if (!payment || !payment.session) {
				throw new AppError(
					httpStatus.NOT_FOUND,
					"Session payment record not found.",
				);
			}

			const session = payment.session;
			const meetingLink = "https://meet.google.com/asdf-ghjk-zxc";

			await tx.session.update({
				where: { sessionId: session.sessionId },
				data: {
					status: SessionStatus.COMFIRMED,
					meetingLink,
				},
			});

			const sessionFeeNum = Number(session.sessionFees);
			const platformCharge = sessionFeeNum * 0.1;
			const mentorEarnings = sessionFeeNum - platformCharge;

			await tx.payment.update({
				where: { paymentId: payment.paymentId },
				data: {
					status: PaymentStatus.PAID,
					transactionId: executedPaymentResult.trxID,
					bkashTrxId: executedPaymentResult.trxID,
					gatewayResponse: executedPaymentResult,
					platformCharge,
					mentorEarnings,
					paidAt: executedPaymentResult.paymentExecuteTime,
				},
			});

			invoiceMailData = {
				session,
				meetingLink,
				trxID: executedPaymentResult.trxID,
				paidAt:
					executedPaymentResult.paymentExecuteTime || new Date().toISOString(),
			};
		},
		{ maxWait: 5000, timeout: 15000 },
	);

	if (invoiceMailData) {
		try {
			const { session, meetingLink, trxID, paidAt } = invoiceMailData;

			const invoiceBuffer = await generateSessionInvoicePDF({
				invoiceNo: session.sessionId.slice(0, 8).toUpperCase(),
				sessionDate: session.slot.schedule.date.toISOString().split("T")[0],
				startTime: new Date(session.slot.startTime).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
				endTime: new Date(session.slot.endTime).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				}),
				meetingLink,
				user: {
					name: session.user.name,
					email: session.user.email,
				},
				mentor: {
					name: session.mentor.user.name,
					headline: session.mentor.headline,
					email: session.mentor.user.email,
				},
				payment: {
					transactionId: trxID,
					amount: session.sessionFees.toString(),
					paidAt,
					paymentMethod: "bKash",
				},
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: session.user.email,
				subject: "Session Confirmed & Invoice - ADVISO",
				text: "Thank you for booking a mentorship session. Please find your official invoice attached.",
				attachments: [
					{
						filename: `invoice-${session.sessionId.slice(0, 8)}.pdf`,
						content: invoiceBuffer,
					},
				],
			});
		} catch (emailErr) {
			console.error("Invoice email delivery failed:", emailErr);
		}
	}

	return {
		redirectURL: `${config.frontend_url}/dashboard/my-sessions?status=success`,
	};
};

export const cancelSessionByUser = async (
	payload: ICancelSessionPayload,
	user: RequestUser,
) => {
	const { sessionId, cancellationReason } = payload;

	const session = await prisma.session.findFirst({
		where: {
			sessionId,
			userId: user.userId,
		},
		include: {
			payment: true,
			slot: true,
		},
	});

	if (!session) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Session not found or unauthorized",
		);
	}

	if (session.status === SessionStatus.CANCELLED) {
		throw new AppError(httpStatus.BAD_REQUEST, "Session is already cancelled");
	}

	if (session.completedSession) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot cancel a completed session",
		);
	}

	const sessionDate = new Date(session.sessionDate);
	const startTime = new Date(session.startUTC);

	const sessionStartDateTime = new Date(
		sessionDate.getFullYear(),
		sessionDate.getMonth(),
		sessionDate.getDate(),
		startTime.getUTCHours(),
		startTime.getUTCMinutes(),
		startTime.getUTCSeconds(),
	);

	const now = new Date();
	const diffInMilliseconds = sessionStartDateTime.getTime() - now.getTime();
	const hoursLeft = diffInMilliseconds / (1000 * 60 * 60);

	if (hoursLeft <= 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot cancel a session that has already started or passed",
		);
	}

	let refundPercentage = 0;
	if (hoursLeft >= 48) {
		refundPercentage = 100;
	} else if (hoursLeft >= 24) {
		refundPercentage = 50;
	} else if (hoursLeft >= 12) {
		refundPercentage = 25;
	} else {
		refundPercentage = 0;
	}

	const isEligibleForRefund =
		refundPercentage > 0 &&
		session.payment?.status === PaymentStatus.PAID &&
		session.payment.bkashPaymentId &&
		session.payment.bkashTrxId;

	let calculatedRefundAmount = 0;
	let bkashRefundResult: any = null;

	if (isEligibleForRefund) {
		const totalPaidAmount = Number(session.payment!.amount);
		calculatedRefundAmount = Number(
			((totalPaidAmount * refundPercentage) / 100).toFixed(2),
		);

		const bkashIdToken = await getBkashIdToken();

		if (!bkashIdToken) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				"Failed to retrieve bKash authorization token",
			);
		}

		const bkashRefundResponse = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/payment/refund`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					Authorization: bkashIdToken,
					"X-App-Key": config.bkash_app_key,
				},
				body: JSON.stringify({
					paymentID: session.payment!.bkashPaymentId,
					trxID: session.payment!.bkashTrxId,
					amount: calculatedRefundAmount.toString(),
					sku: "Session Cancellation",
					reason: cancellationReason || "Session cancelled by user",
				}),
			},
		);

		bkashRefundResult = await bkashRefundResponse.json();

		if (bkashRefundResult.statusCode !== "0000") {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				bkashRefundResult.statusMessage || "bKash refund processing failed",
			);
		}
	}

	const result = await prisma.$transaction(async (tx) => {
		const updatedSession = await tx.session.update({
			where: {
				sessionId: session.sessionId,
			},
			data: {
				status: SessionStatus.CANCELLED,
				cancellationReason:
					cancellationReason ||
					`Cancelled by user. (${refundPercentage}% refund applied)`,
				cancelledAt: now,
			},
		});

		await tx.slot.update({
			where: {
				slotId: session.slotId,
			},
			data: {
				isBooked: false,
			},
		});

		let updatedPayment = session.payment;

		if (session.payment) {
			if (isEligibleForRefund && bkashRefundResult) {
				const originalAmount = Number(session.payment!.amount);
				const remainingAmount = originalAmount - calculatedRefundAmount;

				const PLATFORM_COMMISSION_RATE = 0.1;

				let updatedPlatformCharge = 0;
				let updatedMentorEarnings = 0;

				if (remainingAmount > 0) {
					updatedPlatformCharge = Number(
						(remainingAmount * PLATFORM_COMMISSION_RATE).toFixed(2),
					);
					updatedMentorEarnings = Number(
						(remainingAmount - updatedPlatformCharge).toFixed(2),
					);
				}

				updatedPayment = await tx.payment.update({
					where: {
						sessionId: session.sessionId,
					},
					data: {
						status:
							refundPercentage === 100
								? PaymentStatus.REFUNDED
								: PaymentStatus.PAID,
						refundTrxId: bkashRefundResult.refundTrxID,
						refundAmount: calculatedRefundAmount,
						refundedAt:
							bkashRefundResult.completedTime || new Date().toISOString(),
						refundReason:
							cancellationReason ||
							`Cancelled with ${refundPercentage}% refund`,
						gatewayResponse: bkashRefundResult,
						platformCharge: updatedPlatformCharge,
						mentorEarnings: updatedMentorEarnings,
					},
				});
			} else if (
				refundPercentage === 0 &&
				session.payment.status === PaymentStatus.PAID
			) {
				updatedPayment = await tx.payment.findUnique({
					where: {
						sessionId: session.sessionId,
					},
				});
			}
		}

		return {
			refundPercentage,
			refundAmount: calculatedRefundAmount,
		};
	});

	return result;
};

const getMySessionUser = async (user: IRequestUser) => {
	const isUserValid = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			isDeleted: false,
			role: Role.USER,
		},
	});

	if (!isUserValid) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const mySessions = await prisma.session.findMany({
		where: {
			userId: user.userId,
		},
		include: {
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							email: true,
							profileURL: true,
						},
					},
				},
			},
			payment: {
				select: {
					status: true,
					amount: true,
					paidAt: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return mySessions;
};

const getMySessionDetailsUser = async (
	user: IRequestUser,
	sessionId: string,
) => {
	const isUserValid = await prisma.user.findUnique({
		where: {
			userId: user.userId,
			isDeleted: false,
			role: Role.USER,
		},
	});

	if (!isUserValid) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	const sessionDetails = await prisma.session.findFirst({
		where: {
			sessionId,
			userId: user.userId,
		},
		include: {
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							email: true,
							profileURL: true,
						},
					},
				},
			},
			payment: {
				select: {
					paymentId: true,
					status: true,
					amount: true,
					transactionId: true,
					paidAt: true,
				},
			},
		},
	});

	if (!sessionDetails) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Session details not found or you do not have permission to view it",
		);
	}

	return sessionDetails;
};

const getMySessionsMentor = async (user: IRequestUser) => {
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

	const sessions = await prisma.session.findMany({
		where: {
			mentorId: user.userId,
			status: SessionStatus.COMFIRMED,
		},
		select: {
			sessionId: true,
			meetingLink: true,
			user: {
				select: {
					name: true,
					profileURL: true,
				},
			},
			slot: {
				select: {
					startTime: true,
					endTime: true,
					schedule: {
						select: {
							date: true,
						},
					},
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return sessions;
};

const getSessionDetailsMentor = async (
	user: IRequestUser,
	sessionId: string,
) => {
	const isMentorValid = await prisma.mentor.findFirst({
		where: {
			mentorId: user.userId,
			isDeleted: false,
			user: {
				role: Role.MENTOR,
				isDeleted: false,
			},
		},
	});

	if (!isMentorValid) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied. Only mentors can access this information.",
		);
	}

	const session = await prisma.session.findFirst({
		where: {
			sessionId,
			mentorId: user.userId,
		},
		include: {
			user: {
				select: {
					userId: true,
					name: true,
					email: true,
					profileURL: true,
				},
			},
			slot: {
				select: {
					slotId: true,
					startTime: true,
					endTime: true,
					schedule: {
						select: {
							scheduleId: true,
							date: true,
						},
					},
				},
			},
			payment: {
				select: {
					paymentId: true,
					status: true,
					amount: true,
					mentorEarnings: true,
					transactionId: true,
					paidAt: true,
				},
			},
			review: {
				select: {
					reviewId: true,
					ratings: true,
					comment: true,
					createdAt: true,
				},
			},
		},
	});

	if (!session) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Session details not found or you are not authorized to view this session.",
		);
	}

	return session;
};

const completeSession = async (
	user: IRequestUser,
	payload: ICompleteSessionPayload,
) => {
	const { sessionId, feedback } = payload;

	const mentor = await prisma.mentor.findUnique({
		where: {
			mentorId: user.userId,
			isDeleted: false,
			mentorshipStatus: "OPEN",
		},
	});

	if (!mentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor not found");
	}

	const session = await prisma.session.findUnique({
		where: {
			sessionId,
			mentorId: user.userId,
		},
	});

	if (!session) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Session not found or this session does not belong to you",
		);
	}

	if (session.completedSession) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Session already marked as complete.",
		);
	}

	await prisma.session.update({
		where: { sessionId },
		data: {
			completedSession: true,
			feedbackByMentor: feedback,
		},
	});
};

export const getAllSessionForAdmin = async () => {
	const sessions = await prisma.session.findMany({
		select: {
			sessionId: true,
			sessionDate: true,
			startUTC: true,
			endUTC: true,
			status: true,
			sessionFees: true,
			user: {
				select: {
					name: true,
					email: true,
					profileURL: true,
				},
			},
			mentor: {
				select: {
					user: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			},
			payment: {
				select: {
					status: true,
					platformCharge: true,
					mentorEarnings: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return sessions.map((session) => ({
		sessionId: session.sessionId,
		userName: session.user.name,
		userEmail: session.user.email,
		userProfileURL: session.user.profileURL,
		mentorName: session.mentor.user.name,
		mentorEmail: session.mentor.user.email,
		date: session.sessionDate.toISOString().split("T")[0],
		startTime: session.startUTC.toISOString(),
		endTime: session.endUTC.toISOString(),
		status: session.status,
		fees: Number(session.sessionFees),
		paymentStatus: session.payment?.status || "UNPAID",
		platformCharge: session.payment?.platformCharge
			? Number(session.payment.platformCharge)
			: 0,
		mentorEarnings: session.payment?.mentorEarnings
			? Number(session.payment.mentorEarnings)
			: 0,
	}));
};

export const getSessionDetailsForAdmin = async (sessionId: string) => {
	const session = await prisma.session.findUnique({
		where: {
			sessionId,
		},
		include: {
			user: {
				select: {
					userId: true,
					name: true,
					email: true,
					profileURL: true,
					accountStatus: true,
					createdAt: true,
				},
			},
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					sessionCharge: true,
					user: {
						select: {
							userId: true,
							name: true,
							email: true,
							profileURL: true,
						},
					},
				},
			},
			slot: {
				select: {
					slotId: true,
					startTime: true,
					endTime: true,
					isBooked: true,
					schedule: {
						select: {
							scheduleId: true,
							date: true,
						},
					},
				},
			},
			payment: {
				select: {
					paymentId: true,
					transactionId: true,
					bkashPaymentId: true,
					payerReference: true,
					amount: true,
					platformCharge: true,
					mentorEarnings: true,
					status: true,
					paidAt: true,
					gatewayResponse: true,
					createdAt: true,
				},
			},
			review: {
				select: {
					reviewId: true,
					ratings: true,
					comment: true,
					createdAt: true,
				},
			},
		},
	});

	if (!session) {
		throw new AppError(httpStatus.NOT_FOUND, "Session not found");
	}

	return session;
};

export const SessionServices = {
	getMentorAvailableSlots,
	bookSession,
	paySession,
	bookSessionCallback,
	cancelSessionByUser,
	getMySessionUser,
	getMySessionDetailsUser,

	getMySessionsMentor,
	getSessionDetailsMentor,
	completeSession,

	getAllSessionForAdmin,
	getSessionDetailsForAdmin,
};
