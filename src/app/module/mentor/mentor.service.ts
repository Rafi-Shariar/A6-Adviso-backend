import { UploadApiResponse } from "cloudinary";
import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { IApplyAsMentorPayload } from "./mentor.interface";
import { cloudinary } from "../../lib/cloudinary";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";
import { VerificationStatus } from "../../../generated/prisma/enums";

const applyAsMentor = async (
	user: IRequestUser,
	paylaod: IApplyAsMentorPayload,
	resume: Express.Multer.File | null,
	documents: Express.Multer.File[],
) => {
	await getActiveUserByEmailOrThrow(user.email);

	const existingMentor = await prisma.mentor.findUnique({
		where: { mentorId: user.userId },
	});

	if (existingMentor) {
		if (existingMentor.verificationStatus === VerificationStatus.PENDING) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Your mentor application is currently under review",
			);
		}
		if (existingMentor.verificationStatus === VerificationStatus.APPROVED) {
			throw new AppError(
				httpStatus.CONFLICT,
				"You are already an approved mentor",
			);
		}
	}

	const resumeUploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},

					async (error, result) => {
						if (error) {
							return reject(error);
						}
						if (!result) {
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"No result returned from Cloudinary",
								),
							);
						}
						resolve(result);
					},
				)
				.end(resume?.buffer);
		},
	);

	const additionalFilesUploadResults = await Promise.all(
		documents.map((file) => {
			return new Promise<UploadApiResponse>((resolve, reject) => {
				cloudinary.uploader
					.upload_stream(
						{
							resource_type: "auto",
						},

						async (error, result) => {
							if (error) {
								return reject(error);
							}

							if (!result) {
								return reject(new Error("No result returned from Cloudinary"));
							}

							resolve(result);
						},
					)
					.end(file.buffer);
			});
		}),
	);

	const publicIds = [
		resumeUploadResult.public_id,
		...additionalFilesUploadResults.map((doc) => doc.public_id),
	];

	const mentorData = {
		mentorId: user.userId,
		...paylaod,
		resume: resumeUploadResult.secure_url,
		resumePublicId: resumeUploadResult.public_id,
		verificationStatus: VerificationStatus.PENDING,
		rejectionReason: null,
		documents: additionalFilesUploadResults.map((file) => ({
			url: file.secure_url,
			publicId: file.public_id,
		})),
	};

	try {
		// biome-ignore lint/suspicious/noImplicitAnyLet: <explanation>
		let result;

		if (existingMentor && existingMentor.verificationStatus === "REJECTED") {
			const oldPublicIds: string[] = [];

			if ((existingMentor as any).resumePublicId) {
				oldPublicIds.push((existingMentor as any).resumePublicId);
			}

			if (Array.isArray(existingMentor.documents)) {
				for (const doc of existingMentor.documents as Array<{
					publicId?: string;
				}>) {
					if (doc?.publicId) oldPublicIds.push(doc.publicId);
				}
			}

			if (oldPublicIds.length > 0) {
				await Promise.all(
					oldPublicIds.map((id) =>
						cloudinary.uploader.destroy(id).catch(() => null),
					),
				);
			}

			result = await prisma.mentor.update({
				where: {
					mentorId: user.userId,
				},
				data: mentorData,
			});
		} else {
			result = await prisma.mentor.create({
				data: mentorData,
			});
		}

		return result;
	} catch (error) {
		await Promise.all(
			publicIds.map((publicId) =>
				cloudinary.uploader.destroy(publicId).catch(() => null),
			),
		);

		console.error("ApplyAsMentor DB Error:", error);
		throw new AppError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to submit mentor application. Please try again.",
		);
	}
};

export const mentorServices = {
	applyAsMentor,
};
