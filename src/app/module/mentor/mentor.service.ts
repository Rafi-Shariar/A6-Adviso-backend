import { UploadApiResponse } from "cloudinary";
import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import {
	IApplyAsMentorPayload,
	IApproveMentorPayload,
	IMentorProfileUpdatePayload,
} from "./mentor.interface";
import { cloudinary } from "../../lib/cloudinary";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";
import { IRegisterUser, IRequestUser } from "../auth/auth.interface";
import {
	MentorshipStatus,
	VerificationStatus,
} from "../../../generated/prisma/enums";
import { RequestUser } from "../../middleware/checkAuth";
import path from "node:path";
import ejs, { name } from "ejs";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";
import { calculatePagination } from "../../../helper/paginationHelper";
import { buildPrismaWhereConditions } from "../../../helper/queryBuilder";

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
		reviewedBy: null,
		reviewedAt: null,
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

const approveMentorApplications = async (
	paylaod: IApproveMentorPayload,
	reviewer: RequestUser,
) => {
	const { mentorId, verificationStatus, rejectionReason } = paylaod;

	const existingMentor = await prisma.mentor.findUnique({
		where: {
			mentorId: mentorId,
		},
		include: {
			user: true,
		},
	});

	if (!existingMentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor application not found.");
	}

	if (
		existingMentor.user.accountStatus === "BLOCKED" ||
		existingMentor.user.accountStatus === "SUSPENDED"
	) {
		throw new AppError(httpStatus.GONE, "User account is desabled.");
	}

	if (existingMentor.isDeleted) {
		throw new AppError(httpStatus.GONE, "Application has been deleted.");
	}

	if (existingMentor.verificationStatus !== "PENDING") {
		throw new AppError(
			httpStatus.CONFLICT,
			`Application has been already ${existingMentor.verificationStatus.toLocaleLowerCase()}`,
		);
	}

	const updatedMentor = await prisma.mentor.update({
		where: {
			mentorId: mentorId,
		},
		data: {
			verificationStatus,
			rejectionReason:
				verificationStatus === VerificationStatus.REJECTED
					? rejectionReason
					: null,
			reviewedBy: reviewer.userId,
			reviewedAt: new Date(),
		},
		include: {
			user: {
				select: {
					name: true,
					email: true,
				},
			},
		},
	});

	const isApproved = verificationStatus === VerificationStatus.APPROVED;

	const tempatePath = path.join(
		process.cwd(),
		`src/app/templates/${
			isApproved
				? "mentor-application-approved.ejs"
				: "mentor-application-rejected.ejs"
		}`,
	);

	const templateData = {
		name: updatedMentor.user.name,
		reason: updatedMentor.rejectionReason,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: updatedMentor.user.email,
		subject: isApproved
			? "ADVISO - Your Mentor Application Has Been Approved"
			: "ADVISO - Your Mentor Application Has Been Rejected",
		html,
	});

	return updatedMentor;
};

const getFeaturedMentors = async () => {
	const result = await prisma.mentor.findMany({
		where: {
			verificationStatus: "APPROVED",
			isDeleted: false,
		},
		orderBy: {
			averageRatings: "desc",
		},
		take: 8,
		include: {
			user: {
				select: {
					name: true,
					profileURL: true,
				},
			},
		},
	});

	return result;
};

const getAllMentorsPublicList = async (query: Record<string, any>) => {

	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

	const searchOn = ["headline", "bio", "professionalDomain" , "user.name"];
	const filterBy = ["professionalDomain"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
		filterableFields: filterBy,
		baseConditions: [
			{ isDeleted: false },
			{ verificationStatus: VerificationStatus.APPROVED },
			{ mentorshipStatus: MentorshipStatus.OPEN },
		],
	});

	const [result, total] = await Promise.all([
		prisma.mentor.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			select: {
				mentorId: true,
				headline: true,
				bio: true,
				yearOfExperience: true,
				professionalDomain: true,
				expertiseTags: true,
				sessionCharge: true,
				averageRatings: true,
				user: {
					select: {
						name: true,
						profileURL: true,
					},
				},
			},
		}),

		prisma.mentor.count({
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
		data: result,
	};
};

const getSingleMentorPublicProfile = async (mentorId: string) => {
	const mentor = await prisma.mentor.findUnique({
		where: {
			mentorId,
			isDeleted: false,
			verificationStatus: VerificationStatus.APPROVED,
			mentorshipStatus: MentorshipStatus.OPEN,
		},
		select: {
			user: {
				select: {
					name: true,
					timezone: true,
					profileURL: true,
				},
			},
			headline: true,
			bio: true,
			yearOfExperience: true,
			expertiseTags: true,
			linkedinURL: true,
			professionalDomain: true,
			portfolioURL: true,
			sessionCharge: true,
			totalSessionsCompleted: true,
			averageRatings: true,
			totalReviews: true,
			blogs: {
				where: {
					mentorId: mentorId,
				},
				take: 4,
				orderBy: { createdAt: "desc" },
				select: {
					bannerImage: true,
					title: true,
					createdAt: true,
				},
			},
			reviews: {
				take: 6,
				orderBy: { ratings: "desc" },
				select: {
					ratings: true,
					comment: true,
					createdAt: true,
					session: {
						select: {
							user: {
								select: {
									name: true,
									profileURL: true,
								},
							},
						},
					},
				},
			},
		},
	});

	if (!mentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found.");
	}

	return mentor;
};

const getAllMentorsAdminList = async (query: Record<string, any>) => {
	//TODO:include search on name , email

	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

	const searchOn = ["headline", "bio"];
	const filterBy = [
		"professionalDomain",
		"verificationStatus",
		"mentorshipStatus",
	];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
		filterableFields: filterBy,
	});

	const [result, total] = await Promise.all([
		prisma.mentor.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				user: {
					omit: {
						password: true,
					},
				},
			},
		}),

		prisma.mentor.count({
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
		data: result,
	};
};

const getSingleMentorAdminProfile = async (mentorId: string) => {
	const mentor = await prisma.mentor.findUnique({
		where: {
			mentorId,
		},
		include: {
			user: {
				omit: {
					password: true,
				},
			},
			blogs: true,
			reviews: true,
		},
	});

	if (!mentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found.");
	}

	return mentor;
};

const changeMentorshipStatus = async (
	mentorId: string,
	status: MentorshipStatus,
) => {
	const mentor = await prisma.mentor.findUnique({
		where: {
			mentorId,
		},
	});

	if (!mentor) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found!");
	}

	await prisma.mentor.update({
		where: { mentorId },
		data: {
			mentorshipStatus: status,
		},
	});
};

const updateMentorProfile = async (
	mentorId: string,
	payload: IMentorProfileUpdatePayload,
) => {
	const isMentorExist = await prisma.mentor.findUnique({
		where: {
			mentorId,
			isDeleted: false,
		},
	});

	if (!isMentorExist) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found!");
	}

	const { name, timezone, ...mentorData } = payload;

	const result = await prisma.$transaction(async (tx) => {
		if (name || timezone) {
			await tx.user.update({
				where: { userId: mentorId },
				data: {
					...(name && { name }),
					...(timezone && { timezone }),
				},
			});
		}

		const updatedMentor = await tx.mentor.update({
			where: { mentorId },
			data: {
				...mentorData,
			},
			include: {
				user: {
					select: {
						userId: true,
						name: true,
						email: true,
						timezone: true,
						profileURL: true,
					},
				},
			},
		});

		return updatedMentor;
	});

	return result;
};

export const mentorServices = {
	applyAsMentor,
	approveMentorApplications,
	getFeaturedMentors,
	getAllMentorsPublicList,
	getSingleMentorPublicProfile,
	getAllMentorsAdminList,
	getSingleMentorAdminProfile,
	changeMentorshipStatus,
	updateMentorProfile,
};
