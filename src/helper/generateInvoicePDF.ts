import PDFDocument from "pdfkit";

export interface ISessionInvoiceData {
	invoiceNo: string;
	sessionDate: string;
	startTime: string;
	endTime: string;
	meetingLink?: string;
	user: {
		name: string;
		email: string;
	};
	mentor: {
		name: string;
		headline?: string;
		email: string;
	};
	payment: {
		transactionId: string;
		amount: number | string;
		paidAt: string;
		paymentMethod?: string;
	};
}

export const generateSessionInvoicePDF = (
	data: ISessionInvoiceData,
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({ margin: 50, size: "A4" });
		const pdfChunks: Buffer[] = [];

		doc.on("data", (chunk: Buffer) => pdfChunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(pdfChunks)));
		doc.on("error", (err) => reject(err));

		const primaryColor = "#1E293B"; // Dark Slate
		const secondaryColor = "#0F766E"; // Deep Teal
		const mutedColor = "#64748B"; // Muted Slate
		const borderColor = "#E2E8F0";

		// --- Header Section ---
		doc
			.fillColor(secondaryColor)
			.fontSize(22)
			.font("Helvetica-Bold")
			.text("ADVISO", 50, 45)
			.fontSize(9)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text("Mentorship & Professional Booking Platform", 50, 70);

		// Right-aligned Invoice Title & Number
		doc
			.fillColor(primaryColor)
			.fontSize(16)
			.font("Helvetica-Bold")
			.text("SESSION INVOICE", 350, 45, { align: "right" })
			.fontSize(10)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text(`Invoice No: ${data.invoiceNo}`, 350, 65, { align: "right" })
			.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 350, 78, {
				align: "right",
			});

		// Divider Line
		doc
			.strokeColor(borderColor)
			.lineWidth(1)
			.moveTo(50, 105)
			.lineTo(545, 105)
			.stroke();

		// --- Bill To & Mentor Info (Two Columns) ---
		const topY = 120;

		// Left Column: User (Client)
		doc
			.fontSize(10)
			.font("Helvetica-Bold")
			.fillColor(secondaryColor)
			.text("BILLED TO", 50, topY)
			.moveDown(0.3)
			.font("Helvetica-Bold")
			.fillColor(primaryColor)
			.text(data.user.name)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text(data.user.email);

		// Right Column: Mentor
		doc
			.fontSize(10)
			.font("Helvetica-Bold")
			.fillColor(secondaryColor)
			.text("MENTOR DETAILS", 350, topY)
			.moveDown(0.3)
			.font("Helvetica-Bold")
			.fillColor(primaryColor)
			.text(data.mentor.name)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text(data.mentor.headline || "Professional Mentor")
			.text(data.mentor.email);

		// --- Session Summary Box ---
		const sessionBoxY = 205;
		doc.rect(50, sessionBoxY, 495, 70).fillAndStroke("#F8FAFC", borderColor);

		doc
			.fontSize(10)
			.font("Helvetica-Bold")
			.fillColor(primaryColor)
			.text("Session Booking Schedule", 65, sessionBoxY + 12)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text(`Date: ${data.sessionDate}`, 65, sessionBoxY + 30)
			.text(`Time: ${data.startTime} - ${data.endTime}`, 65, sessionBoxY + 45)
			.text(
				`Meeting Link: ${data.meetingLink || "Link will be shared in dashboard"}`,
				260,
				sessionBoxY + 30,
				{ width: 270 },
			);

		// --- Itemized Payment Table ---
		const tableHeaderY = 300;

		// Table Header Bar
		doc.rect(50, tableHeaderY, 495, 25).fill(primaryColor);

		doc
			.font("Helvetica-Bold")
			.fontSize(9)
			.fillColor("#FFFFFF")
			.text("ITEM DESCRIPTION", 65, tableHeaderY + 8)
			.text("TRX ID", 260, tableHeaderY + 8)
			.text("AMOUNT (BDT)", 450, tableHeaderY + 8, { align: "right" });

		// Table Row Content
		const rowY = tableHeaderY + 35;
		doc
			.font("Helvetica")
			.fontSize(10)
			.fillColor(primaryColor)
			.text("1-on-1 Mentorship Session (20 Mins)", 65, rowY)
			.fillColor(mutedColor)
			.text(data.payment.transactionId, 260, rowY)
			.font("Helvetica-Bold")
			.fillColor(primaryColor)
			.text(`${Number(data.payment.amount).toFixed(2)}`, 450, rowY, {
				align: "right",
			});

		// Row Bottom Border
		doc
			.strokeColor(borderColor)
			.lineWidth(1)
			.moveTo(50, rowY + 25)
			.lineTo(545, rowY + 25)
			.stroke();

		// Total Amount Row
		const totalY = rowY + 35;
		doc
			.fontSize(11)
			.font("Helvetica-Bold")
			.fillColor(primaryColor)
			.text("Total Paid:", 360, totalY)
			.fillColor(secondaryColor)
			.text(`${Number(data.payment.amount).toFixed(2)} BDT`, 450, totalY, {
				align: "right",
			});

		// --- Payment Verification Note ---
		const metaY = totalY + 40;
		doc.rect(50, metaY, 495, 45).strokeColor(borderColor).stroke();

		doc
			.font("Helvetica-Bold")
			.fontSize(9)
			.fillColor(primaryColor)
			.text(
				`Payment Method: ${data.payment.paymentMethod || "bKash Tokenized Checkout"}`,
				65,
				metaY + 10,
			)
			.font("Helvetica")
			.fillColor(mutedColor)
			.text(`Payment Time: ${data.payment.paidAt}`, 65, metaY + 25);

		// --- Professional Footer ---
		doc
			.fontSize(8)
			.fillColor(mutedColor)
			.text(
				"Thank you for booking with Adviso. Please be in the meeting room 5 minutes prior to the scheduled slot.",
				50,
				720,
				{ align: "center", width: 495 },
			)
			.text(
				"For any inquiries or technical assistance, contact support@adviso.com",
				50,
				735,
				{ align: "center", width: 495 },
			);

		doc.end();
	});
};
