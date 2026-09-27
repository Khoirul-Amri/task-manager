const RECURRENCE_TYPES = ["daily", "weekly", "monthly", "custom"];
const CUSTOM_UNITS = ["days", "weeks"];

/**
 * Menormalisasi konfigurasi recurring task dari form atau import.
 * @param {object|null} recurrence Konfigurasi recurring.
 * @returns {object|null} Konfigurasi valid atau null.
 */
export function normalizeRecurrence(recurrence) {
	if (!recurrence || typeof recurrence !== "object") {
		return null;
	}

	const type = RECURRENCE_TYPES.includes(recurrence.type) ? recurrence.type : null;
	if (!type) {
		return null;
	}

	return {
		type,
		interval: Number.isInteger(recurrence.interval) && recurrence.interval > 0
			? recurrence.interval
			: 1,
		daysOfWeek: Array.isArray(recurrence.daysOfWeek)
			? [...new Set(recurrence.daysOfWeek.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
			: [],
		unit: CUSTOM_UNITS.includes(recurrence.unit) ? recurrence.unit : "days",
	};
}

/**
 * Mengubah Date lokal menjadi format tanggal ISO tanpa timezone shift.
 * @param {Date} date Tanggal lokal.
 * @returns {string} Format YYYY-MM-DD.
 */
function formatLocalDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Menghitung tanggal occurrence berikutnya.
 * @param {string|null} dueDate Tanggal occurrence saat ini.
 * @param {object|null} recurrence Konfigurasi recurring.
 * @param {Date} [referenceDate] Fallback anchor jika dueDate kosong.
 * @returns {string|null} Tanggal berikutnya atau null untuk task biasa.
 */
export function getNextDueDate(dueDate, recurrence, referenceDate = new Date()) {
	const normalized = normalizeRecurrence(recurrence);
	if (!normalized) {
		return null;
	}

	const nextDate = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date(referenceDate);
	nextDate.setHours(0, 0, 0, 0);

	if (normalized.type === "daily") {
		nextDate.setDate(nextDate.getDate() + normalized.interval);
	}

	if (normalized.type === "weekly") {
		if (normalized.daysOfWeek.length === 0) {
			nextDate.setDate(nextDate.getDate() + normalized.interval * 7);
		} else {
			for (let offset = 1; offset <= 7 * normalized.interval; offset += 1) {
				const candidate = new Date(nextDate);
				candidate.setDate(nextDate.getDate() + offset);
				if (normalized.daysOfWeek.includes(candidate.getDay())) {
					return formatLocalDate(candidate);
				}
			}
		}
	}

	if (normalized.type === "monthly") {
		const targetDay = nextDate.getDate();
		nextDate.setDate(1);
		nextDate.setMonth(nextDate.getMonth() + normalized.interval);
		const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
		nextDate.setDate(Math.min(targetDay, lastDay));
	}

	if (normalized.type === "custom") {
		const amount = normalized.interval * (normalized.unit === "weeks" ? 7 : 1);
		nextDate.setDate(nextDate.getDate() + amount);
	}

	return formatLocalDate(nextDate);
}

export { CUSTOM_UNITS, RECURRENCE_TYPES };
