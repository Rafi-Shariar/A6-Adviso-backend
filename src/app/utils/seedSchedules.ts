// src/scripts/seedSchedulesAndSessions.ts

import { Role, SessionStatus } from "../../generated/prisma/enums";
import { prisma } from "../lib/prisma";


// Time parse helper (HH:mm:ss -> Date)
const parseTimeStringToDate = (timeStr: string): Date => {
  return new Date(`1970-01-01T${timeStr}Z`);
};

// Date parse helper (YYYY-MM-DD -> Date)
const parseDateStringToDate = (dateStr: string): Date => {
  return new Date(`${dateStr}T00:00:00.000Z`);
};

const timePresets = [
  { startTime: "10:00:00", endTime: "12:00:00" }, // 6 slots (20 mins each)
  { startTime: "15:00:00", endTime: "17:00:00" }, // 6 slots
  { startTime: "19:00:00", endTime: "21:00:00" }, // 6 slots
];

export const seedSchedulesAndSessions = async () => {
  try {
    const existingSchedules = await prisma.schedule.count();

    if (existingSchedules > 0) {
      console.log("ℹ️ Schedules already exist. Skipping seeding.");
      return;
    }

    console.log("🌱 Seeding Schedules, Slots & Sessions...");

    // ১. Mentors fetch
    const mentors = await prisma.mentor.findMany({
      where: { isDeleted: false },
      select: { mentorId: true, sessionCharge: true },
    });

    if (mentors.length === 0) {
      console.log("⚠️ No mentors found. Please seed mentors first.");
      return;
    }

    // ২. Sessions book korar jonno ekjon Demo Student (User) create ba fetch kora
    const studentUser = await prisma.user.upsert({
      where: { email: "student.demo@example.com" },
      update: {},
      create: {
        name: "Demo Student",
        email: "student.demo@example.com",
        password: "Password123!",
        role: Role.USER,
        profileURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
        isEmailVerified: true,
      },
    });

    const SLOT_DURATION_MS = 20 * 60 * 1000; // ২০ মিনিট
    const today = new Date();

    for (let i = 0; i < mentors.length; i++) {
      const mentor = mentors[i];
      const scheduleCount = (i % 3) + 1; // Proti mentor 1 theke 3 ti schedule pabe

      for (let s = 0; s < scheduleCount; s++) {
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + s + 1);
        const dateStr = scheduleDate.toISOString().split("T")[0];

        const preset = timePresets[s % timePresets.length];
        const scheduleStart = parseTimeStringToDate(preset.startTime);
        const scheduleEnd = parseTimeStringToDate(preset.endTime);

        // ৩. ২০ মিনিটের স্লট ক্যালকুলেশন (Apnar logic onujayi)
        const slotsData: { startTime: Date; endTime: Date }[] = [];
        let currentSlotStart = scheduleStart.getTime();
        const scheduleEndMs = scheduleEnd.getTime();

        while (currentSlotStart + SLOT_DURATION_MS <= scheduleEndMs) {
          const currentSlotEnd = currentSlotStart + SLOT_DURATION_MS;
          slotsData.push({
            startTime: new Date(currentSlotStart),
            endTime: new Date(currentSlotEnd),
          });
          currentSlotStart = currentSlotEnd;
        }

        // ৪. Schedule er shathe nested Slots create
        const createdSchedule = await prisma.schedule.create({
          data: {
            mentorId: mentor.mentorId,
            date: parseDateStringToDate(dateStr),
            startTime: scheduleStart,
            endTime: scheduleEnd,
            slots: {
              create: slotsData,
            },
          },
          include: {
            slots: true,
          },
        });

        // ৫. Mock Data Visualization er jonno 1st slot-ti Demo Student diye Booked & Session create kora
        if (createdSchedule.slots.length > 0 && (i + s) % 2 === 0) {
          const slotToBook = createdSchedule.slots[0];

          // Slot status Booked kora
          await prisma.slot.update({
            where: { slotId: slotToBook.slotId },
            data: { isBooked: true },
          });

          // Session insert kora
          await prisma.session.create({
            data: {
              userId: studentUser.userId,
              mentorId: mentor.mentorId,
              scheduleId: createdSchedule.scheduleId,
              slotId: slotToBook.slotId,
              sessionFees: mentor.sessionCharge,
              sessionDate: parseDateStringToDate(dateStr),
              startUTC: slotToBook.startTime,
              endUTC: slotToBook.endTime,
              status: SessionStatus.COMFIRMED,
              purpose: "Career guidance and system design review.",
              meetingLink: "https://meet.google.com/adviso-demo-room",
              completedSession: false,
            },
          });
        }
      }
    }

    console.log("🚀 Schedules, Slots & Demo Sessions Seeded Successfully!");
  } catch (error) {
    console.error("❌ Error seeding schedules and sessions:", error);
  }
};