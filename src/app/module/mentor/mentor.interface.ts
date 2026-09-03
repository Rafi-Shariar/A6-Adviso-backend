import { VerificationStatus } from "../../../generated/prisma/enums";

export interface IApplyAsMentorPayload {
	headline: string;
	bio: string;
	yearOfExperience: number;
	expertiseTags: string[];
	linkedinURL: string;
	professionalDomain: string;
	portfolioURL?: string;
	sessionCharge: number;
}


export interface IApproveMentorPayload {
	mentorId : string;
	verificationStatus : VerificationStatus;
	rejectionReason? : string;
}