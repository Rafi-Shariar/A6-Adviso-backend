import cron from "node-cron";

import { prisma } from "./prisma";
import { PaymentStatus, SessionStatus } from "../../generated/prisma/enums";

export const releaseUnpaidSessionSlots = () => {

  cron.schedule("*/5 * * * *", async () => {
    try {

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);


      const expiredSessions = await prisma.session.findMany({
        where: {
          status: SessionStatus.PENDING,
          createdAt: {
            lt: fifteenMinutesAgo,
          },
          OR: [
            { payment: null }, 
            { payment: { status: PaymentStatus.PENDING } }, 
          ],
        },
        select: {
          sessionId: true,
          slotId: true,
        },
      });

      if (expiredSessions.length === 0) {
        return;
      }

      const expiredSessionIds = expiredSessions.map((s) => s.sessionId);
      const expiredSlotIds = expiredSessions.map((s) => s.slotId);


      await prisma.$transaction([
        prisma.slot.updateMany({
          where: {
            slotId: {
              in: expiredSlotIds,
            },
          },
          data: {
            isBooked: false,
          },
        }),

        prisma.session.updateMany({
          where: {
            sessionId: {
              in: expiredSessionIds,
            },
          },
          data: {
            status: SessionStatus.CANCELLED,
            cancellationReason:
              "Auto-cancelled: Payment not completed within 15 minutes.",
            cancelledAt: new Date(),
          },
        }),

        prisma.payment.updateMany({
          where: {
            sessionId: {
              in: expiredSessionIds,
            },
            status: PaymentStatus.PENDING,
          },
          data: {
            status: PaymentStatus.FAILED,
          },
        }),
      ]);

      console.log(
        `[Cron Job]: Released ${expiredSlotIds.length} slots and cancelled unpaid sessions older than 15 minutes.`
      );
    } catch (error) {
      console.error(
        "[Cron Job]: Failed to release unpaid booking slots",
        error
      );
    }
  });
};