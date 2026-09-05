import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

// ১. গ্লোবাল লিমিটার: প্রতি ১৫ মিনিটে সর্বোচ্চ ১০০টি রিকোয়েস্ট
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  max: 100, // প্রতি IP থেকে ১৫ মিনিটে ১০০ রিকোয়েস্ট
  standardHeaders: true, // `RateLimit-*` হেডার রিটার্ন করবে
  legacyHeaders: false, // `X-RateLimit-*` হেডার ডিসেবল করবে
  message: {
    success: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});

// ২. অথেনটিকেশন বা সেনসিটিভ রুটের জন্য কঠোর লিমিটার: ১৫ মিনিটে সর্বোচ্চ ৫ বার
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ১৫ মিনিট
  max: 5, // প্রতি IP থেকে ১৫ মিনিটে মাত্র ৫ বার চেষ্টা করা যাবে
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: httpStatus.TOO_MANY_REQUESTS,
    message: "Too many login attempts. Please try again after 15 minutes",
  },
});