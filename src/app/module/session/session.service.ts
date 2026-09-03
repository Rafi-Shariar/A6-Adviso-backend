import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { IRequestUser } from "../auth/auth.interface";
import { userInfo } from "node:os";
import { Role } from "../../../generated/prisma/enums";
import { IBookSessionPayload } from "./session.interface";
import { getBkashIdToken } from "../../lib/bkash";
import config from "../../config";

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
						callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
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

export const SessionServices = {
	getMentorAvailableSlots,
	bookSession,
};
