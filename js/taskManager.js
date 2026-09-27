import { loadStore, saveStore } from "./storage.js";
import { getNextDueDate, normalizeRecurrence } from "./recurrence.js";

const DEFAULT_PRIORITY = "medium";
const PRIORITIES = ["low", "medium", "high"];

/**
 * Membuat ID unik dengan fallback untuk browser lama atau lingkungan test.
 * @returns {string} ID task baru.
 */
function createId() {
	return typeof crypto?.randomUUID === "function"
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Mengelola task tanpa ketergantungan pada DOM.
 */
export class TaskManager {
	/**
	 * @param {{load?: Function, save?: Function}} dependencies Dependency storage.
	 */
	constructor({ load = loadStore, save = saveStore } = {}) {
		this.load = load;
		this.save = save;
		this.store = load();
	}

	/**
	 * Mengganti seluruh task setelah payload import divalidasi.
	 * @param {Array<object>} tasks Task hasil validasi import.
	 * @returns {Array<object>} Task yang aktif setelah import.
	 */
	replaceTasks(tasks) {
		this.store.tasks = structuredClone(tasks);
		this.persist();
		return this.getTasks();
	}

	/**
	 * Mengambil salinan task agar pemanggil tidak mengubah state internal langsung.
	 * @returns {Array<object>} Daftar task.
	 */
	getTasks() {
		return structuredClone(this.store.tasks);
	}

	/**
	 * Mengambil filter tersimpan tanpa membocorkan state internal.
	 * @returns {Array<object>} Daftar saved filter.
	 */
	getSavedFilters() {
		return structuredClone(this.store.savedFilters ?? []);
	}

	/**
	 * Mengambil snapshot lengkap untuk export.
	 * @returns {object} Root store.
	 */
	getStore() {
		return structuredClone(this.store);
	}

	/**
	 * Mengambil settings aplikasi.
	 * @returns {object} Settings.
	 */
	getSettings() {
		return structuredClone(this.store.settings ?? {});
	}

	/**
	 * Menyimpan settings aplikasi.
	 * @param {object} changes Settings yang diubah.
	 * @returns {object} Settings terbaru.
	 */
	updateSettings(changes) {
		this.store.settings = { ...this.store.settings, ...changes };
		this.persist();
		return this.getSettings();
	}

	/**
	 * Menyimpan satu sesi Pomodoro yang selesai.
	 * @param {object} session Data sesi timer.
	 * @returns {object} Sesi tersimpan.
	 */
	addPomodoroSession(session) {
		const savedSession = {
			id: createId(),
			taskId: session.taskId ?? null,
			startedAt: Number.isFinite(session.startedAt) ? session.startedAt : Date.now(),
			durationMin: Number.isFinite(session.durationMin) ? session.durationMin : 25,
			type: session.type === "break" ? "break" : "work",
			completed: session.completed === true,
		};
		this.store.pomodoroSessions ??= [];
		this.store.pomodoroSessions.push(savedSession);
		this.persist();
		return structuredClone(savedSession);
	}

	/**
	 * Menyimpan kombinasi filter aktif.
	 * @param {string} name Nama filter.
	 * @param {object} criteria Kriteria filter.
	 * @returns {object} Saved filter yang dibuat.
	 */
	addSavedFilter(name, criteria) {
		const normalizedName = String(name ?? "").trim();
		if (!normalizedName) {
			throw new Error("Nama filter wajib diisi.");
		}
		const savedFilter = {
			id: createId(),
			name: normalizedName,
			criteria: structuredClone(criteria),
		};
		this.store.savedFilters ??= [];
		this.store.savedFilters.push(savedFilter);
		this.persist();
		return structuredClone(savedFilter);
	}

	/**
	 * Mengubah status arsip task.
	 * @param {string} taskId ID task.
	 * @param {boolean} archived Status arsip.
	 * @returns {object} Task terbaru.
	 */
	setArchived(taskId, archived) {
		const task = this.findTask(taskId);
		task.archived = archived === true;
		task.updatedAt = Date.now();
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Menghapus filter tersimpan.
	 * @param {string} filterId ID saved filter.
	 */
	deleteSavedFilter(filterId) {
		const filters = this.store.savedFilters ?? [];
		const index = filters.findIndex((filter) => filter.id === filterId);
		if (index === -1) {
			throw new Error("Filter tersimpan tidak ditemukan.");
		}
		filters.splice(index, 1);
		this.persist();
	}

	/**
	 * Mengganti root store hasil import yang sudah dimigrasikan.
	 * @param {object} store Store v2 tervalidasi.
	 */
	replaceStore(store) {
		this.store = structuredClone(store);
		this.persist();
	}

	/**
	 * Membuat task baru dan menyimpannya.
	 * @param {object} input Field task dari form.
	 * @returns {object} Task yang dibuat.
	 */
	addTask(input) {
		const now = Date.now();
		const task = {
			id: createId(),
			title: String(input.title ?? "").trim(),
			description: String(input.description ?? "").trim(),
			notes: String(input.notes ?? ""),
			completed: false,
			priority: PRIORITIES.includes(input.priority) ? input.priority : DEFAULT_PRIORITY,
			category: String(input.category ?? "").trim(),
			tags: Array.isArray(input.tags)
				? [...new Set(input.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))]
				: [],
			dueDate: input.dueDate || null,
			dueTime: input.dueTime || null,
			durationMin: Number.isFinite(input.durationMin) && input.durationMin > 0 ? input.durationMin : null,
			autoPomodoro: input.autoPomodoro !== false,
			recurrence: normalizeRecurrence(input.recurrence),
			dependsOn: Array.isArray(input.dependsOn) ? [...new Set(input.dependsOn)] : [],
			subtasks: [],
			attachments: [],
			customFieldValues: {},
			order: this.store.tasks.length,
			createdAt: now,
			updatedAt: now,
			completedAt: null,
			archived: false,
		};

		if (!task.title) {
			throw new Error("Judul tugas wajib diisi.");
		}

		this.store.tasks.push(task);
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Memperbarui field task yang diberikan.
	 * @param {string} taskId ID task.
	 * @param {object} changes Field yang ingin diubah.
	 * @returns {object} Task terbaru.
	 */
	updateTask(taskId, changes) {
		const task = this.findTask(taskId);
		const nextTitle = changes.title === undefined ? task.title : String(changes.title).trim();

		if (!nextTitle) {
			throw new Error("Judul tugas wajib diisi.");
		}

		if (changes.priority !== undefined && !PRIORITIES.includes(changes.priority)) {
			throw new Error("Prioritas tugas tidak valid.");
		}

		if (changes.recurrence !== undefined) {
			changes.recurrence = normalizeRecurrence(changes.recurrence);
		}

		if (changes.dependsOn !== undefined) {
			if (!Array.isArray(changes.dependsOn) || changes.dependsOn.includes(taskId)) {
				throw new Error("Dependency task tidak valid.");
			}
			const taskIds = new Set(this.store.tasks.map((item) => item.id));
			if (changes.dependsOn.some((dependencyId) => !taskIds.has(dependencyId))) {
				throw new Error("Dependency task tidak ditemukan.");
			}
			changes.dependsOn = [...new Set(changes.dependsOn)];
		}

		if (changes.tags !== undefined) {
			if (!Array.isArray(changes.tags)) {
				throw new Error("Tag task tidak valid.");
			}
			changes.tags = [...new Set(changes.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))];
		}

		Object.assign(task, changes, {
			title: nextTitle,
			description:
				changes.description === undefined
					? task.description
					: String(changes.description).trim(),
			category:
				changes.category === undefined ? task.category : String(changes.category).trim(),
			updatedAt: Date.now(),
		});
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Mengubah status selesai dan mengisi waktu penyelesaian.
	 * @param {string} taskId ID task.
	 * @param {boolean} completed Status baru.
	 * @returns {object} Task terbaru.
	 */
	setCompleted(taskId, completed) {
		return this.updateTask(taskId, {
			completed: completed === true,
			completedAt: completed === true ? Date.now() : null,
		});
	}

	/**
	 * Memperbarui tanggal, jam mulai, dan durasi blok melalui satu API.
	 * @param {string} taskId ID task.
	 * @param {{date?: string|null, time?: string|null, durationMin?: number|null, autoPomodoro?: boolean}} schedule Jadwal baru.
	 * @returns {object} Task terbaru.
	 */
	setSchedule(taskId, schedule) {
		const task = this.findTask(taskId);
		const date = schedule.date || null;
		const time = schedule.time || null;
		const requestedDuration = Number.isFinite(schedule.durationMin) && schedule.durationMin > 0
			? schedule.durationMin
			: null;
		const durationMin = date && time
			? (requestedDuration ?? this.getSettings().defaultBlockDurationMin ?? 30)
			: null;
		if ((time || durationMin) && !date) {
			throw new Error("Jadwal dengan jam membutuhkan tanggal.");
		}
		if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
			throw new Error("Format jam harus HH:MM.");
		}
		task.dueDate = date;
		task.dueTime = date ? time : null;
		task.durationMin = date && time ? durationMin : null;
		if (schedule.autoPomodoro !== undefined) task.autoPomodoro = schedule.autoPomodoro !== false;
		task.updatedAt = Date.now();
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Mencari task lain yang overlap dengan jadwal kandidat.
	 * @param {string} taskId Task yang dikecualikan.
	 * @param {string|null} date Tanggal.
	 * @param {string|null} time Waktu mulai.
	 * @param {number|null} durationMin Durasi.
	 * @returns {Array<object>} Task yang bentrok.
	 */
	getScheduleConflicts(taskId, date, time, durationMin) {
		if (!date || !time || !durationMin) return [];
		const start = Date.parse(`${date}T${time}:00`);
		const end = start + durationMin * 60_000;
		return this.store.tasks.filter((task) => {
			if (task.id === taskId || task.archived || task.dueDate !== date || !task.dueTime || !task.durationMin) return false;
			const otherStart = Date.parse(`${task.dueDate}T${task.dueTime}:00`);
			const otherEnd = otherStart + task.durationMin * 60_000;
			return start < otherEnd && otherStart < end;
		}).map((task) => structuredClone(task));
	}

	/**
	 * Menyelesaikan task dan membuat satu occurrence berikutnya jika recurring.
	 * @param {string} taskId ID task.
	 * @returns {{task: object, nextTask: object|null}} Hasil completion.
	 */
	completeTask(taskId, force = false) {
		const task = this.findTask(taskId);
		if (task.completed) {
			return { task: structuredClone(task), nextTask: null };
		}
		const incompleteDependencies = this.getIncompleteDependencies(taskId);
		if (incompleteDependencies.length > 0 && !force) {
			throw new Error(
				`Dependency belum selesai: ${incompleteDependencies.map((dependency) => dependency.title).join(", ")}`,
			);
		}

		task.completed = true;
		task.completedAt = Date.now();
		task.updatedAt = Date.now();
		let nextTask = null;
		if (task.recurrence) {
			nextTask = this.createNextRecurringTask(task);
			this.store.tasks.push(nextTask);
		}
		this.persist();
		return { task: structuredClone(task), nextTask: structuredClone(nextTask) };
	}

	/**
	 * Mengambil dependency task yang belum selesai.
	 * @param {string} taskId ID task.
	 * @returns {Array<object>} Dependency yang masih aktif.
	 */
	getIncompleteDependencies(taskId) {
		const task = this.findTask(taskId);
		return (task.dependsOn ?? [])
			.map((dependencyId) => this.store.tasks.find((item) => item.id === dependencyId))
			.filter((dependency) => dependency && !dependency.completed)
			.map((dependency) => structuredClone(dependency));
	}

	/**
	 * Membuat occurrence berikutnya tanpa menumpuk occurrence masa depan.
	 * @param {object} sourceTask Task recurring yang baru selesai.
	 * @returns {object} Task occurrence berikutnya.
	 */
	createNextRecurringTask(sourceTask) {
		const now = Date.now();
		return {
			...structuredClone(sourceTask),
			id: createId(),
			dueDate: getNextDueDate(sourceTask.dueDate, sourceTask.recurrence),
			completed: false,
			completedAt: null,
			subtasks: (sourceTask.subtasks ?? []).map((subtask) => this.resetSubtaskTree(subtask)),
			order: this.store.tasks.length,
			createdAt: now,
			updatedAt: now,
		};
	}

	/**
	 * Mereset status subtugas secara rekursif untuk occurrence baru.
	 * @param {object} subtask Subtask sumber.
	 * @returns {object} Subtask baru yang belum selesai.
	 */
	resetSubtaskTree(subtask) {
		return {
			...structuredClone(subtask),
			id: createId(),
			completed: false,
			subtasks: (subtask.subtasks ?? []).map((child) => this.resetSubtaskTree(child)),
		};
	}

	/**
	 * Menambahkan subtugas ke task induk.
	 * @param {string} taskId ID task induk.
	 * @param {string} title Judul subtugas.
	 * @returns {object} Subtugas yang dibuat.
	 */
	addSubtask(taskId, title, parentSubtaskId = null) {
		const task = this.findTask(taskId);
		const normalizedTitle = String(title ?? "").trim();
		if (!normalizedTitle) {
			throw new Error("Judul subtugas wajib diisi.");
		}

		const subtask = { id: createId(), title: normalizedTitle, completed: false, subtasks: [] };
		if (parentSubtaskId) {
			const parent = this.findSubtask(task.subtasks, parentSubtaskId);
			if (!parent) {
				throw new Error("Parent subtugas tidak ditemukan.");
			}
			parent.subtasks ??= [];
			parent.subtasks.push(subtask);
		} else {
			task.subtasks.push(subtask);
		}
		task.updatedAt = Date.now();
		this.persist();
		return structuredClone(subtask);
	}

	/**
	 * Mengubah status subtugas.
	 * @param {string} taskId ID task induk.
	 * @param {string} subtaskId ID subtugas.
	 * @param {boolean} completed Status baru.
	 * @returns {object} Task terbaru.
	 */
	setSubtaskCompleted(taskId, subtaskId, completed) {
		const task = this.findTask(taskId);
		const subtask = this.findSubtask(task.subtasks, subtaskId);
		if (!subtask) {
			throw new Error("Subtugas tidak ditemukan.");
		}
		subtask.completed = completed === true;
		task.updatedAt = Date.now();
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Mencari subtugas di seluruh tree secara depth-first.
	 * @param {Array<object>} subtasks Tree subtugas.
	 * @param {string} subtaskId ID yang dicari.
	 * @returns {object|null} Subtugas atau null.
	 */
	findSubtask(subtasks, subtaskId) {
		for (const subtask of subtasks ?? []) {
			if (subtask.id === subtaskId) {
				return subtask;
			}
			const nested = this.findSubtask(subtask.subtasks, subtaskId);
			if (nested) {
				return nested;
			}
		}
		return null;
	}

	/**
	 * Menghapus subtugas dari task induk.
	 * @param {string} taskId ID task induk.
	 * @param {string} subtaskId ID subtugas.
	 * @returns {object} Task terbaru.
	 */
	deleteSubtask(taskId, subtaskId) {
		const task = this.findTask(taskId);
		if (!this.removeSubtask(task.subtasks, subtaskId)) {
			throw new Error("Subtugas tidak ditemukan.");
		}
		task.updatedAt = Date.now();
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Menghapus node subtugas dari tree secara rekursif.
	 * @param {Array<object>} subtasks Tree yang dimutasi.
	 * @param {string} subtaskId ID node yang dihapus.
	 * @returns {boolean} True jika node ditemukan.
	 */
	removeSubtask(subtasks, subtaskId) {
		const index = subtasks.findIndex((subtask) => subtask.id === subtaskId);
		if (index !== -1) {
			subtasks.splice(index, 1);
			return true;
		}
		return subtasks.some((subtask) => this.removeSubtask(subtask.subtasks ?? [], subtaskId));
	}

	/**
	 * Menyimpan urutan task hasil drag and drop.
	 * @param {Array<string>} taskIds ID task dalam urutan baru.
	 * @returns {Array<object>} Task setelah urutan diperbarui.
	 */
	reorderTasks(taskIds) {
		const taskById = new Map(this.store.tasks.map((task) => [task.id, task]));
		if (
			taskIds.length !== this.store.tasks.length ||
			taskIds.some((taskId) => !taskById.has(taskId))
		) {
			throw new Error("Urutan task tidak valid.");
		}

		taskIds.forEach((taskId, index) => {
			const task = taskById.get(taskId);
			task.order = index;
			task.updatedAt = Date.now();
		});
		this.store.tasks.sort((firstTask, secondTask) => firstTask.order - secondTask.order);
		this.persist();
		return this.getTasks();
	}

	/**
	 * Menghapus task berdasarkan ID.
	 * @param {string} taskId ID task.
	 * @returns {object} Task yang dihapus untuk kebutuhan undo.
	 */
	deleteTask(taskId) {
		const taskIndex = this.store.tasks.findIndex((task) => task.id === taskId);
		if (taskIndex === -1) {
			throw new Error("Tugas tidak ditemukan.");
		}

		const [deletedTask] = this.store.tasks.splice(taskIndex, 1);
		this.persist();
		return structuredClone(deletedTask);
	}

	/**
	 * Menyisipkan kembali task yang sebelumnya dihapus.
	 * @param {object} task Task yang akan dipulihkan.
	 * @returns {object} Task yang dipulihkan.
	 */
	restoreTask(task) {
		if (!task?.id || this.store.tasks.some((currentTask) => currentTask.id === task.id)) {
			throw new Error("Task tidak valid atau sudah tersedia.");
		}

		this.store.tasks.push(structuredClone(task));
		this.persist();
		return structuredClone(task);
	}

	/**
	 * Mencari task dan melempar error jika tidak ditemukan.
	 * @param {string} taskId ID task.
	 * @returns {object} Task internal.
	 */
	findTask(taskId) {
		const task = this.store.tasks.find((currentTask) => currentTask.id === taskId);
		if (!task) {
			throw new Error("Tugas tidak ditemukan.");
		}
		return task;
	}

	/**
	 * Menulis perubahan state ke storage dan memberi sinyal jika gagal.
	 */
	persist() {
		if (!this.save(this.store)) {
			throw new Error("Data tidak dapat disimpan. Penyimpanan mungkin penuh.");
		}
	}
}
