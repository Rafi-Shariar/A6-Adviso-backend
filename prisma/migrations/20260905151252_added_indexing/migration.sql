-- CreateIndex
CREATE INDEX "mentors_verificationStatus_isDeleted_idx" ON "mentors"("verificationStatus", "isDeleted");

-- CreateIndex
CREATE INDEX "mentors_professionalDomain_verificationStatus_isDeleted_idx" ON "mentors"("professionalDomain", "verificationStatus", "isDeleted");

-- CreateIndex
CREATE INDEX "mentors_sessionCharge_idx" ON "mentors"("sessionCharge");

-- CreateIndex
CREATE INDEX "sessions_slotId_idx" ON "sessions"("slotId");

-- CreateIndex
CREATE INDEX "sessions_status_sessionDate_idx" ON "sessions"("status", "sessionDate");

-- CreateIndex
CREATE INDEX "slots_scheduleId_isBooked_idx" ON "slots"("scheduleId", "isBooked");

-- CreateIndex
CREATE INDEX "slots_scheduleId_startTime_idx" ON "slots"("scheduleId", "startTime");

-- CreateIndex
CREATE INDEX "users_role_isDeleted_idx" ON "users"("role", "isDeleted");

-- CreateIndex
CREATE INDEX "users_accountStatus_isDeleted_idx" ON "users"("accountStatus", "isDeleted");
