import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";

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

// const getUserSessions = async(userId : string) => {

//     const user = await prisma.user.findUnique({
//         where:{
//             userId,
//             accountStatus : "ACTIVE",
//             isDeleted : false
//         },
//     })

//     if(!user){
//         throw new AppError(httpStatus.NOT_FOUND, "User not found")
//     }

//     const result = await prisma.session.findMany({
//         where : {
//             userId
//         },
//         orderBy : {
//             updatedAt : "desc"
//         },
//         include : {
//             mentor : {
//                 select : {
//                     mentorId : true,
//                     headline : true,
//                     user : {
//                         select : {
//                             name : true,

//                         }
//                     }
//                 }
//             }
//         }
//     })

//     return result

// }

export const SessionServices = {
	getMentorAvailableSlots,
};
