import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentServices } from "./payment.service";

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await paymentServices.getMyPayments(user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My payments retrieved successfully",
		data: result,
	});
});

const getMyPaymentDetails = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const paymentId = req.params.paymentId as string;

	const result = await paymentServices.getMyPaymentDetails(user, paymentId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My payment details retrieved successfully",
		data: result,
	});
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await paymentServices.getAllPayments(user, req.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All payments retrieved successfully",
		data: result,
	});
});

const getPaymentDetailsAdmin = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;
		const paymentId = req.params.paymentId as string;

		const result = await paymentServices.getPaymentDetailsAdmin(
			user,
			paymentId,
		);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payment details retrieved successfully",
			data: result,
		});
	},
);

export const PaymentController = {
	getMyPayments,
	getMyPaymentDetails,
	getAllPayments,
	getPaymentDetailsAdmin,
};
