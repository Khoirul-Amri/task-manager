const STORAGE_KEY = "task-manager-data";
const CURRENT_SCHEMA_VERSION = 2;

/**
 * Membuat ID lokal dengan fallback untuk lingkungan tanpa crypto.randomUUID.
 * @returns {string} ID unik.
 */
function createId() {
	return typeof crypto?.randomUUID === "function"
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Membuat bentuk root data yang selalu konsisten untuk localStorage.
 * @returns {object} Root store schema v2.
 */
export function createEmptyStore() {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		tasks: [],
		habits: [],
		templates: [],
		pomodoroSessions: [],
		savedFilters: [],
		customFieldDefinitions: [],
		gamification: { points: 0, level: 1 },
		settings: {
			theme: "system",
			notificationsEnabled: false,
			pomodoroWorkMin: 25,
			pomodoroBreakMin: 5,
			autoStartPomodoroOnSchedule: true,
			defaultBlockDurationMin: 30,
		},
	};
}

/**
 * Menormalisasi subtugas secara rekursif untuk schema v2.
 * @param {unknown} subtasks Data subtugas dari v1 atau v2.
 * @param {number} depth Kedalaman rekursi saat ini.
 * @returns {Array<object>} Subtugas schema v2.
 */
function migrateSubtasks(subtasks, depth = 0) {
	if (!Array.isArray(subtasks)) {
		return [];
	}

	return subtasks
		.filter((subtask) => subtask && typeof subtask.title === "string")
		.map((subtask) => ({
			id: typeof subtask.id === "string" && subtask.id ? subtask.id : createId(),
			title: subtask.title.trim(),
			completed: subtask.completed === true,
			subtasks: depth < 5 ? migrateSubtasks(subtask.subtasks, depth + 1) : [],
		}));
}

/**
 * Mengubah task lama ke bentuk schema terbaru tanpa mengubah objek asal.
 * @param {object} task Data task dari storage atau import.
 * @returns {object} Task yang sudah dinormalisasi.
 */
function migrateTask(task, defaultBlockDurationMin = 30) {
	const now = Date.now();

	return {
		id: typeof task.id === "string" && task.id ? task.id : createId(),
		title: typeof task.title === "string" ? task.title.trim() : "",
		description: typeof task.description === "string" ? task.description : "",
		notes: typeof task.notes === "string" ? task.notes : "",
		completed: task.completed === true,
		priority: ["low", "medium", "high"].includes(task.priority)
			? task.priority
			: "medium",
		category: typeof task.category === "string" ? task.category.trim() : "",
		tags: Array.isArray(task.tags)
			? [...new Set(task.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))]
			: [],
		dueDate: typeof task.dueDate === "string" && task.dueDate ? task.dueDate : null,
		dueTime: typeof task.dueTime === "string" && task.dueTime ? task.dueTime : null,
		durationMin: Number.isFinite(task.durationMin) && task.durationMin > 0
			? task.durationMin
			: (task.dueTime ? defaultBlockDurationMin : null),
		autoPomodoro: task.autoPomodoro !== false,
		recurrence: task.recurrence && typeof task.recurrence === "object"
			? {
				type: ["daily", "weekly", "monthly", "custom"].includes(task.recurrence.type)
					? task.recurrence.type
					: "daily",
				interval: Number.isInteger(task.recurrence.interval) && task.recurrence.interval > 0
					? task.recurrence.interval
					: 1,
				daysOfWeek: Array.isArray(task.recurrence.daysOfWeek)
					? task.recurrence.daysOfWeek.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
					: [],
				unit: ["days", "weeks"].includes(task.recurrence.unit)
					? task.recurrence.unit
					: "days",
			}
			: null,
		dependsOn: Array.isArray(task.dependsOn)
			? [...new Set(task.dependsOn.filter((id) => typeof id === "string" && id))]
			: [],
		subtasks: migrateSubtasks(task.subtasks),
		attachments: Array.isArray(task.attachments)
			? task.attachments
					.filter((attachment) => attachment && typeof attachment.name === "string")
					.map((attachment) => ({
						id: typeof attachment.id === "string" && attachment.id ? attachment.id : createId(),
						name: attachment.name,
						type: typeof attachment.type === "string" ? attachment.type : "application/octet-stream",
						size: Number.isFinite(attachment.size) ? attachment.size : 0,
						indexedDbKey: typeof attachment.indexedDbKey === "string" ? attachment.indexedDbKey : "",
					}))
			: [],
		customFieldValues:
			task.customFieldValues && typeof task.customFieldValues === "object"
				? { ...task.customFieldValues }
				: {},
		order: Number.isFinite(task.order) ? task.order : 0,
		createdAt: Number.isFinite(task.createdAt) ? task.createdAt : now,
		updatedAt: Number.isFinite(task.updatedAt) ? task.updatedAt : now,
		completedAt: Number.isFinite(task.completedAt) ? task.completedAt : null,
		archived: task.archived === true,
	};
}

/**
 * Memigrasikan root data dari versi lama ke schema terbaru.
 * @param {unknown} value Nilai hasil parsing JSON.
 * @returns {{schemaVersion: number, tasks: Array<object>}}
 */
export function migrateSchema(value) {
	if (!value || typeof value !== "object" || !Array.isArray(value.tasks)) {
		return createEmptyStore();
	}
	const defaults = createEmptyStore();
	const sourceSettings = value.settings && typeof value.settings === "object" ? value.settings : {};
	const defaultBlockDurationMin = Number.isFinite(sourceSettings.defaultBlockDurationMin) && sourceSettings.defaultBlockDurationMin > 0
		? sourceSettings.defaultBlockDurationMin
		: defaults.settings.defaultBlockDurationMin;
	const savedFilters = Array.isArray(value.savedFilters)
		? value.savedFilters
			.filter((filter) => filter && typeof filter === "object" && typeof filter.name === "string")
			.map((filter) => ({
				id: typeof filter.id === "string" && filter.id ? filter.id : createId(),
				name: filter.name.trim(),
				criteria: filter.criteria && typeof filter.criteria === "object" ? {
					query: typeof filter.criteria.query === "string" ? filter.criteria.query : "",
					status: typeof filter.criteria.status === "string" ? filter.criteria.status : "all",
					priority: typeof filter.criteria.priority === "string" ? filter.criteria.priority : "all",
					category: typeof filter.criteria.category === "string" ? filter.criteria.category : "all",
					tags: Array.isArray(filter.criteria.tags) ? filter.criteria.tags.filter((tag) => typeof tag === "string") : [],
					sort: typeof filter.criteria.sort === "string" ? filter.criteria.sort : "order",
				} : { query: "", status: "all", priority: "all", category: "all", tags: [], sort: "order" },
			}))
		: defaults.savedFilters;

	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		tasks: value.tasks
			.filter((task) => task && typeof task === "object")
			.map((task) => migrateTask(task, defaultBlockDurationMin)),
		habits: Array.isArray(value.habits) ? value.habits : defaults.habits,
		templates: Array.isArray(value.templates) ? value.templates : defaults.templates,
		pomodoroSessions: Array.isArray(value.pomodoroSessions)
			? value.pomodoroSessions
			: defaults.pomodoroSessions,
		savedFilters,
		customFieldDefinitions: Array.isArray(value.customFieldDefinitions)
			? value.customFieldDefinitions
			: defaults.customFieldDefinitions,
		gamification: value.gamification && typeof value.gamification === "object"
			? {
				points: Number.isFinite(value.gamification.points) ? value.gamification.points : 0,
				level: Number.isInteger(value.gamification.level) && value.gamification.level > 0
					? value.gamification.level
					: 1,
			}
			: defaults.gamification,
		settings: value.settings && typeof value.settings === "object"
			? {
				theme: ["system", "light", "dark"].includes(value.settings.theme)
					? value.settings.theme
					: "system",
				notificationsEnabled: value.settings.notificationsEnabled === true,
				pomodoroWorkMin: Number.isInteger(value.settings.pomodoroWorkMin) && value.settings.pomodoroWorkMin > 0
					? value.settings.pomodoroWorkMin
					: 25,
				pomodoroBreakMin: Number.isInteger(value.settings.pomodoroBreakMin) && value.settings.pomodoroBreakMin > 0
					? value.settings.pomodoroBreakMin
					: 5,
				autoStartPomodoroOnSchedule: value.settings.autoStartPomodoroOnSchedule !== false,
				defaultBlockDurationMin: Number.isFinite(value.settings.defaultBlockDurationMin) && value.settings.defaultBlockDurationMin > 0
					? value.settings.defaultBlockDurationMin
					: 30,
			}
			: defaults.settings,
	};
}

const migrateStore = migrateSchema;

/**
 * Memvalidasi payload JSON dari file import sebelum digunakan aplikasi.
 * @param {unknown} value Payload hasil parsing file.
 * @returns {{schemaVersion: number, tasks: Array<object>}} Store valid.
 */
export function validateImportData(value) {
	if (!value || typeof value !== "object" || !Array.isArray(value.tasks)) {
		throw new Error("Format file tidak valid.");
	}

	const taskIds = new Set();
	value.tasks.forEach((task) => {
		if (!task || typeof task !== "object" || typeof task.title !== "string" || !task.title.trim()) {
			throw new Error("File berisi task dengan judul tidak valid.");
		}
		if (typeof task.id !== "string" || !task.id || taskIds.has(task.id)) {
			throw new Error("File berisi ID task duplikat atau tidak valid.");
		}
		taskIds.add(task.id);
	});

	return migrateStore(value);
}

/**
 * Membaca dan memvalidasi data task dari localStorage.
 * Data rusak diperlakukan sebagai store kosong agar aplikasi tetap terbuka.
 * @returns {{schemaVersion: number, tasks: Array<object>}}
 */
export function loadStore() {
	try {
		const rawValue = localStorage.getItem(STORAGE_KEY);
		return rawValue ? migrateStore(JSON.parse(rawValue)) : createEmptyStore();
	} catch {
		return createEmptyStore();
	}
}

/**
 * Menyimpan store terbaru ke localStorage.
 * @param {{schemaVersion: number, tasks: Array<object>}} store Data aplikasi.
 * @returns {boolean} True jika penyimpanan berhasil.
 */
export function saveStore(store) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateSchema(store)));
		return true;
	} catch {
		return false;
	}
}

export { CURRENT_SCHEMA_VERSION, STORAGE_KEY };
