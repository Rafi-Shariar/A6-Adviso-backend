import { Role } from "../../../generated/prisma/enums";
import { buildPrismaWhereConditions } from "../../../helper/queryBuilder";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRequestUser } from "../auth/auth.interface";
import { ICreateSchedulePayload } from "./schedule.interface";
import httpStatus from "http-status";

export const createSchedule = async (
	mentorId: string,
	payload: ICreateSchedulePayload,
) => {
	const { date, startTime, endTime } = payload;

	const isMentorExists = await prisma.mentor.findUnique({
		where: {
			mentorId,
			isDeleted: false,
		},
	});

	if (!isMentorExists) {
		throw new AppError(httpStatus.NOT_FOUND, "Mentor profile not found");
	}

	if (isMentorExists.mentorshipStatus === "BLOCKED") {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Your mentorship status is BLOCKED. Please contact support.",
		);
	}

	const targetDate = new Date(date);
	const scheduleStartTime = new Date(startTime);
	const scheduleEndTime = new Date(endTime);

	if (scheduleStartTime >= scheduleEndTime) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Start time must be strictly before end time.",
		);
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (targetDate < today) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot create schedules for past dates.",
		);
	}

	const overlappingSchedule = await prisma.schedule.findFirst({
		where: {
			mentorId,
			date: targetDate,
			isDeleted: false,
			AND: [
				{
					startTime: {
						lt: scheduleEndTime,
					},
				},
				{
					endTime: {
						gt: scheduleStartTime,
					},
				},
			],
		},
	});

	if (overlappingSchedule) {
		throw new AppError(
			httpStatus.CONFLICT,
			"This schedule slot overlaps with an existing schedule for the selected date.",
		);
	}

	const SLOT_DURATION_MS = 20 * 60 * 1000;
	const slotsData: { startTime: Date; endTime: Date }[] = [];

	let currentSlotStart = scheduleStartTime.getTime();
	const scheduleEnd = scheduleEndTime.getTime();

	while (currentSlotStart + SLOT_DURATION_MS <= scheduleEnd) {
		const currentSlotEnd = currentSlotStart + SLOT_DURATION_MS;

		slotsData.push({
			startTime: new Date(currentSlotStart),
			endTime: new Date(currentSlotEnd),
		});

		currentSlotStart = currentSlotEnd;
	}

	if (slotsData.length === 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Schedule duration must be at least 20 minutes to generate slots.",
		);
	}

	const result = await prisma.schedule.create({
		data: {
			mentorId,
			date: targetDate,
			startTime: scheduleStartTime,
			endTime: scheduleEndTime,
			slots: {
				create: slotsData,
			},
		},
		include: {
			slots: {
				select: {
					slotId: true,
					startTime: true,
					endTime: true,
					isBooked: true,
				},
			},
		},
	});

	return result;
};

export const getMySchedulesMentor = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const andConditions: any[] = [
		{ mentorId: user.userId },
		{ isDeleted: false },
	];

	if (query.date) {
		const startOfDay = new Date(query.date as string);
		startOfDay.setUTCHours(0, 0, 0, 0);

		const endOfDay = new Date(query.date as string);
		endOfDay.setUTCHours(23, 59, 59, 999);

		andConditions.push({
			date: {
				gte: startOfDay,
				lte: endOfDay,
			},
		});
	}

	const whereConditions = buildPrismaWhereConditions({
		query,
		baseConditions: andConditions,
	});

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
			"Access denied. Only mentors can access schedules.",
		);
	}

	const schedules = await prisma.schedule.findMany({
		where: whereConditions,
		include: {
			slots: {
				orderBy: {
					startTime: "asc",
				},
			},
		},
		orderBy: {
			date: "asc",
		},
	});

	return schedules;
};

export const getAllSchedulesForAdmin = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const isAdmin = await prisma.user.findFirst({
		where: {
			userId: user.userId,
			isDeleted: false,
		},
	});

	if (!isAdmin) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admin only.");
	}

	const andConditions: any[] = [{ isDeleted: false }];

	if (query.date) {
		const startOfDay = new Date(query.date as string);
		startOfDay.setUTCHours(0, 0, 0, 0);

		const endOfDay = new Date(query.date as string);
		endOfDay.setUTCHours(23, 59, 59, 999);

		andConditions.push({
			date: {
				gte: startOfDay,
				lte: endOfDay,
			},
		});
	}

	const searchOn = ["mentor.user.name", "mentor.user.email"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		baseConditions: andConditions,
		searchableFields: searchOn,
	});

	const schedules = await prisma.schedule.findMany({
		where: whereConditions,
		include: {
			mentor: {
				select: {
					mentorId: true,
					user: {
						select: {
							name: true,
							email: true,
							profileURL: true,
						},
					},
				},
			},
			slots: {
				orderBy: {
					startTime: "asc",
				},
			},
		},
		orderBy: {
			date: "desc",
		},
	});

	return schedules;
};

export const deleteScheduleMentor = async (
	user: IRequestUser,
	scheduleId: string,
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
			"Access denied. Only mentors can delete schedules.",
		);
	}

	const schedule = await prisma.schedule.findFirst({
		where: {
			scheduleId,
			mentorId: user.userId,
			isDeleted: false,
		},
		include: {
			slots: {
				where: {
					isBooked: true,
				},
			},
		},
	});

	if (!schedule) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Schedule not found or you are not authorized to delete it.",
		);
	}

	if (schedule.slots.length > 0) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot delete schedule because one or more slots are already booked.",
		);
	}

	return await prisma.$transaction(async (tx) => {
		await tx.slot.deleteMany({
			where: {
				scheduleId,
			},
		});

		const deletedSchedule = await tx.schedule.delete({
			where: {
				scheduleId,
			},
		});

		return deletedSchedule;
	});
};

export const ScheduleServices = {
	createSchedule,
	getMySchedulesMentor,
	getAllSchedulesForAdmin,
	deleteScheduleMentor,
};
