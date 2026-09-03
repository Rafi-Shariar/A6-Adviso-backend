import { prisma } from "../../lib/prisma";


export const getMentorAvailableSlots = async (mentorId: string) => {
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

  // রেসপন্স অবজেক্ট ফ্ল্যাট (Flat) করে রিটার্ন

  const result = availableSlots.map((item) => ({
    slotId: item.slotId,
    scheduleId: item.schedule.scheduleId,
    date: item.schedule.date.toISOString().split("T")[0],
    startTime: item.startTime.toISOString(),
    endTime: item.endTime.toISOString(),
  }));

  return result;
};

export const SessionServices = {
  getMentorAvailableSlots,
};
