import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { MentorValidation } from "./mentor.validation";
import { mentorServices } from "./mentor.service";
import { IRequestUser } from "../auth/auth.interface";

const ApplyAsMentor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldname: string]: Express.Multer.File[] };
	const resume = files?.["resume"] ? files["resume"][0] : null;
	const documents = files?.["documents"] || [];
	const user = req.user as IRequestUser;

	const zodValidationResult = MentorValidation.applyAsMentorZodSchema.safeParse(
		JSON.parse(req.body.data),
	);

	if (!zodValidationResult.success) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			zodValidationResult.error.issues[0].message,
		);
	}

	const payload = zodValidationResult.data;

	const result = await mentorServices.applyAsMentor(
		user,
		payload,
		resume,
		documents,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Mentor application successful. You application is under review.",
		data: result,
	});
});

export const MentorController = {
	ApplyAsMentor,
};
