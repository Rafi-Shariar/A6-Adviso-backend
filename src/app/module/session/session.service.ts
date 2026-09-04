import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { IRequestUser } from "../auth/auth.interface";
import { userInfo } from "node:os";
import {
	PaymentStatus,
	Role,
	SessionStatus,
} from "../../../generated/prisma/enums";
import { IBookSessionPayload } from "./session.interface";
import { getBkashIdToken } from "../../lib/bkash";
import config from "../../config";
import { generateSessionInvoicePDF } from "../../../helper/generateInvoicePDF";
import { transporter } from "../../lib/nodemailer";
import { isValid } from "zod/v3";
import { name } from "ejs";

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
					sessionDate : slot.schedule.date,
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

			// সেশন কনফার্ম করা
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
					gatewayResponse: executedPaymentResult,
					platformCharge,
					mentorEarnings,
					paidAt : executedPaymentResult.paymentExecuteTime
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

const getMySessionUser = async(user : IRequestUser) => {

	const isUserValid = await prisma.user.findUnique({
		where : {
			userId : user.userId,
			isDeleted : false,
			role : Role.USER
		}
	})

	if(!isUserValid){
		throw new AppError(httpStatus.NOT_FOUND, "User not found")
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

	return mySessions
}

const getMySessionDetailsUser = async(user : IRequestUser, sessionId : string) => {

	const isUserValid = await prisma.user.findUnique({
		where : {
			userId : user.userId,
			isDeleted : false,
			role : Role.USER
		}
	})

	if(!isUserValid){
		throw new AppError(httpStatus.NOT_FOUND, "User not found")
	}

	const sessionDetails = await prisma.session.findUnique({
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

  if(!sessionDetails){
	throw new AppError(httpStatus.NOT_FOUND, "Session details not found or you do not have permission to view it")
  }


	return sessionDetails
}

export const getMySessionsMentor = async (user: IRequestUser) => {
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

  return sessions


}

export const getSessionDetailsMentor = async (
  user: IRequestUser,
  sessionId: string
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
      "Access denied. Only mentors can access this information."
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
      "Session details not found or you are not authorized to view this session."
    );
  }

  return session;
};

export const SessionServices = {
	getMentorAvailableSlots,
	bookSession,
	bookSessionCallback,
	getMySessionUser,
	getMySessionDetailsUser,
	getMySessionsMentor,
	getSessionDetailsMentor
};
