import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ReviewServices } from "./review.service";

const addReview = catchAsync(async (req: Request, res: Response) => {

	const user = req.user!;
	const payload = req.body;

	const result = await ReviewServices.addReview(user, payload)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Review added successfully",
		data: result,
	});
});

export const ReviewController = {
	addReview
};
