const PRIORITY_ALIASES = {
	low: "low",
	rendah: "low",
	medium: "medium",
	sedang: "medium",
	high: "high",
	tinggi: "high",
};

/**
 * Memformat tanggal lokal menjadi YYYY-MM-DD.
 * @param {Date} date Tanggal lokal.
 * @returns {string} Tanggal ISO lokal.
 */
function formatLocalDate(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Mencari tanggal relatif dari teks quick-add.
 * @param {string} text Input natural language.
 * @param {Date} referenceDate Tanggal acuan.
 * @returns {string|null} Deadline atau null.
 */
function parseRelativeDate(text, referenceDate) {
	const normalizedText = text.toLocaleLowerCase();
	const date = new Date(referenceDate);
	date.setHours(0, 0, 0, 0);
	if (/\b(hari ini|today)\b/.test(normalizedText)) return formatLocalDate(date);
	if (/\b(besok|tomorrow)\b/.test(normalizedText)) {
		date.setDate(date.getDate() + 1);
		return formatLocalDate(date);
	}
	if (/\b(lusa|day after tomorrow)\b/.test(normalizedText)) {
		date.setDate(date.getDate() + 2);
		return formatLocalDate(date);
	}
	if (/\b(minggu depan|next week)\b/.test(normalizedText)) {
		date.setDate(date.getDate() + 7);
		return formatLocalDate(date);
	}
	const weekdayMatch = normalizedText.match(/(?:setiap|every|next)\s+(minggu|senin|selasa|rabu|kamis|jumat|sabtu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
	if (weekdayMatch) {
		const weekdays = { minggu: 0, ahad: 0, sunday: 0, senin: 1, monday: 1, selasa: 2, tuesday: 2, rabu: 3, wednesday: 3, kamis: 4, thursday: 4, jumat: 5, friday: 5, sabtu: 6, saturday: 6 };
		const targetDay = weekdays[weekdayMatch[1]];
		const offset = ((targetDay - date.getDay()) + 7) % 7 || 7;
		date.setDate(date.getDate() + offset);
		return formatLocalDate(date);
	}
	return null;
}

/**
 * Mem-parse quick-add natural language menjadi field task.
 * @param {string} input Teks quick-add.
 * @param {Date} [referenceDate] Tanggal acuan untuk testing.
 * @returns {{title: string, category: string, priority: string, dueDate: string|null, dueTime: string|null}} Field task.
 */
export function parseQuickAdd(input, referenceDate = new Date()) {
	let title = String(input ?? "").trim();
	const categoryMatch = title.match(/#([\p{L}\p{N}_-]+)/u);
	const priorityMatch = title.match(/!([\p{L}\p{N}_-]+)/u);
	const timeMatch = title.match(/\b(?:jam|at)\s+(\d{1,2})(?::(\d{2}))?\s*(pagi|siang|sore|malam|am|pm)?\b/i);
	const rangeMatch = title.match(/\b(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\b/);
	const durationMatch = title.match(/\b(\d+(?:\.\d+)?)\s*(jam|hours?|menit|minutes?)\b/i);
	const category = categoryMatch?.[1] ?? "";
	const priority = PRIORITY_ALIASES[(priorityMatch?.[1] ?? "").toLocaleLowerCase()] ?? "medium";
	let dueTime = null;
	if (timeMatch) {
		let hour = Number(timeMatch[1]);
		const minute = Number(timeMatch[2] ?? 0);
		const period = timeMatch[3]?.toLocaleLowerCase();
		if ((period === "siang" || period === "sore" || period === "malam" || period === "pm") && hour < 12) hour += 12;
		if ((period === "pagi" || period === "am") && hour === 12) hour = 0;
		dueTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
	}
	if (rangeMatch) dueTime = `${String(Number(rangeMatch[1])).padStart(2, "0")}:${rangeMatch[2]}`;
	let durationMin = null;
	if (rangeMatch) {
		const start = Number(rangeMatch[1]) * 60 + Number(rangeMatch[2]);
		const end = Number(rangeMatch[3]) * 60 + Number(rangeMatch[4]);
		durationMin = end > start ? end - start : null;
	} else if (durationMatch) {
		durationMin = /jam|hour/i.test(durationMatch[2]) ? Number(durationMatch[1]) * 60 : Number(durationMatch[1]);
	}
	const dueDate = parseRelativeDate(title, referenceDate);
	title = title
		.replace(/#[\p{L}\p{N}_-]+/gu, "")
		.replace(/![\p{L}\p{N}_-]+/gu, "")
		.replace(/\b(?:jam|at)\s+\d{1,2}(?::\d{2})?\s*(?:pagi|siang|sore|malam|am|pm)?\b/giu, "")
		.replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/g, "")
		.replace(/\b\d+(?:\.\d+)?\s*(?:jam|hours?|menit|minutes?)\b/giu, "")
		.replace(/\b(hari ini|today|besok|tomorrow|lusa|day after tomorrow|minggu depan|next week|(?:setiap|every|next)\s+(?:minggu|senin|selasa|rabu|kamis|jumat|sabtu|ahad|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/giu, "")
		.replace(/\s{2,}/g, " ")
		.trim();
	return { title, category, priority, dueDate, dueTime, durationMin };
}
