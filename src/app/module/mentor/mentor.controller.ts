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

const approveMentorApplications = catchAsync(
	async (req: Request, res: Response) => {
		const paylaod = req.body;
		const user = req.user!;

		const result = await mentorServices.approveMentorApplications(
			paylaod,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Mentor pplication verified",
			data: result,
		});
	},
);

const getFeaturedMentors = catchAsync(async (req: Request, res: Response) => {
	const result = await mentorServices.getFeaturedMentors();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Featured mentors retrieved successfully.",
		data: result,
	});
});

const getAllMentorsPublicList = catchAsync(
	async (req: Request, res: Response) => {
		const result = await mentorServices.getAllMentorsPublicList(req.query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "All mentors retrieved successfully.",
			meta: result.meta,
			data: result.data,
		});
	},
);

const getSingleMentorPublicProfile = catchAsync(
	async (req: Request, res: Response) => {
		const mentorId = req.params.mentorId as string;

		const result = await mentorServices.getSingleMentorPublicProfile(mentorId);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Mentor Profile Retrieved Successfully",
			data: result,
		});
	},
);

const getAllMentorsAdminList = catchAsync(
	async (req: Request, res: Response) => {
		const result = await mentorServices.getAllMentorsAdminList(req.query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "All mentors retrieved successfully.",
			meta: result.meta,
			data: result.data,
		});
	},
);

const getSingleMentorAdminProfile = catchAsync(
	async (req: Request, res: Response) => {
		const mentorId = req.params.mentorId as string;

		const result = await mentorServices.getSingleMentorAdminProfile(mentorId);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Mentor Profile Retrieved Successfully",
			data: result,
		});
	},
);

const changeMentorshipStatus = catchAsync(
	async (req: Request, res: Response) => {
		const mentorId = req.params.mentorId as string;
		const { status } = req.body;

		await mentorServices.changeMentorshipStatus(mentorId, status);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: `Mentorship status changed to ${status}`,
			data: null,
		});
	},
);

const updateMentorProfile = catchAsync(async (req: Request, res: Response) => {
	const mentorId = req.user?.userId as string;

	const result = await mentorServices.updateMentorProfile(mentorId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Mentor profile updated successfully",
		data: result,
	});
});

export const MentorController = {
	ApplyAsMentor,
	approveMentorApplications,
	getFeaturedMentors,
	getAllMentorsPublicList,
	getSingleMentorPublicProfile,
	getAllMentorsAdminList,
	getSingleMentorAdminProfile,
	changeMentorshipStatus,
	updateMentorProfile,
};
