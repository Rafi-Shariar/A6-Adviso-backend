import { SessionStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { ITimeSlot } from "./session.interface";

const getMentorAvailableSlots = async (mentorId: string) => {
	const SLOT_DURATION_MS = 20 * 60 * 1000;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const schedules = await prisma.schedule.findMany({
		where: {
			mentorId,
			isDeleted: false,
			date: { gte: today },
		},

		include: {
			sessions: {
				where: {
					status: {
						notIn: [SessionStatus.CANCELLED],
					},
				},
				select: {
					startUTC: true,
					endUTC: true,
				},
			},
		},
		orderBy: [{ date: "asc" }, { startTime: "asc" }],
	});

	const availableSlots: ITimeSlot[] = [];

	for (const schedule of schedules) {
		let currentSlotStart = new Date(schedule.startTime).getTime();
		const scheduleEnd = new Date(schedule.endTime).getTime();

		while (currentSlotStart + SLOT_DURATION_MS <= scheduleEnd) {
			const currentSlotEnd = currentSlotStart + SLOT_DURATION_MS;

			const isBooked = schedule.sessions.some((session) => {
				const sessionStart = new Date(session.startUTC).getTime();
				const sessionEnd = new Date(session.endUTC).getTime();

				return currentSlotStart < sessionEnd && currentSlotEnd > sessionStart;
			});

			if (!isBooked) {
				availableSlots.push({
					scheduleId: schedule.scheduleId,
					date: schedule.date.toISOString().split("T")[0],
					startTime: new Date(currentSlotStart).toISOString(),
					endTime: new Date(currentSlotEnd).toISOString(),
				});
			}

			currentSlotStart = currentSlotEnd;
		}
	}

	return availableSlots;
};

export const SessionServices = {
	getMentorAvailableSlots,
};
