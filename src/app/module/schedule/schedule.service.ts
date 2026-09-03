import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
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
	const slotStartTime = new Date(startTime);
	const slotEndTime = new Date(endTime);

	if (slotStartTime >= slotEndTime) {
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
						lt: slotEndTime,
					},
				},
				{
					endTime: {
						gt: slotStartTime,
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

	const result = await prisma.schedule.create({
		data: {
			mentorId,
			date: targetDate,
			startTime: slotStartTime,
			endTime: slotEndTime,
		},
	});

	return result;
};

export const ScheduleServices = {
	createSchedule,
};
