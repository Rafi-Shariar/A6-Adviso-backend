import { existsSync } from "node:fs";

export interface ITimeSlot {
	scheduleId: string;
	date: string;
	startTime: string;
	endTime: string;
}

export interface IBookSessionPayload {
	purpose: string;
}

export interface ICompleteSessionPayload{
	sessionId : string;
	feedback : string;
}
