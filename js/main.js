import { TaskManager } from "./taskManager.js";
import { renderTaskList } from "./ui.js";
import { filterAndSortTasks } from "./filters.js";
import { debounce } from "./utils.js";
import { CURRENT_SCHEMA_VERSION, validateImportData } from "./storage.js";
import { renderTimeline } from "./views/timelineView.js";
import { renderBoard } from "./views/boardView.js";
import { renderCalendar, renderWeekCalendar } from "./views/calendarView.js";
import { renderMatrix, getTaskQuadrant } from "./views/matrixView.js";
import { PomodoroTimer, formatTimer } from "./pomodoro.js";
import { supportsNotifications, requestNotificationPermission, scheduleTaskReminders } from "./notifications.js";
import { parseQuickAdd } from "./nlpParser.js";
import { ScheduleScheduler } from "./scheduler.js";

const DEMO_TASK = {
	id: "demo-task",
	title: "Rancang struktur Task Manager",
	description: "Pisahkan data, tampilan, dan interaksi agar aplikasi mudah dirawat.",
	completed: false,
	priority: "high",
	category: "Belajar",
	subtasks: [{ id: "demo-subtask", title: "Buat data schema", completed: true }],
};

const THEME_STORAGE_KEY = "task-manager-theme";

/**
 * Menentukan tema awal dari preferensi tersimpan atau tema sistem.
 * @returns {"light"|"dark"} Tema yang digunakan.
 */
function getInitialTheme() {
	const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
	if (savedTheme === "light" || savedTheme === "dark") {
		return savedTheme;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Menerapkan tema ke root document dan memperbarui label tombol.
 * @param {"light"|"dark"} theme Tema yang dipilih.
 */
function applyTheme(theme) {
	document.documentElement.dataset.theme = theme;
	const themeToggle = document.querySelector("#theme-toggle");
	if (themeToggle) {
		themeToggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
		themeToggle.setAttribute(
			"aria-label",
			theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode",
		);
	}
}

applyTheme(getInitialTheme());

/**
 * Mendaftarkan service worker hanya pada origin yang mendukungnya.
 */
if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
	navigator.serviceWorker.register("./sw.js").catch(() => {
		// Aplikasi tetap berjalan normal jika service worker gagal didaftarkan.
	});
}

/**
 * Menginisialisasi render awal aplikasi tanpa mengubah data tersimpan.
 */
function initializeApp() {
	const taskList = document.querySelector(".task-list");
	const taskDialog = document.querySelector("#task-dialog");
	const taskForm = document.querySelector("#task-form");
	const titleInput = document.querySelector("#task-title");
	const descriptionInput = document.querySelector("#task-description");
	const priorityInput = document.querySelector("#task-priority");
	const dueDateInput = document.querySelector("#task-due-date");
	const dueTimeInput = document.querySelector("#task-due-time");
	const durationInput = document.querySelector("#task-duration");
	const autoPomodoroInput = document.querySelector("#task-auto-pomodoro");
	const recurrenceTypeInput = document.querySelector("#task-recurrence");
	const recurrenceOptions = document.querySelector("#recurrence-options");
	const recurrenceIntervalInput = document.querySelector("#recurrence-interval");
	const recurrenceUnitInput = document.querySelector("#recurrence-unit");
	const weeklyDays = document.querySelector("#weekly-days");
	const categoryInput = document.querySelector("#task-category");
	const categoryOptions = document.querySelector("#category-options");
	const categoryList = document.querySelector(".app-sidebar section");
	const searchInput = document.querySelector("#task-search");
	const quickAddInput = document.querySelector("#quick-add-input");
	const quickAddButton = document.querySelector("#quick-add-button");
	const statusFilter = document.querySelector("#status-filter");
	const priorityFilter = document.querySelector("#priority-filter");
	const categoryFilter = document.querySelector("#category-filter");
	const tagFilter = document.querySelector("#tag-filter");
	const tagsInput = document.querySelector("#task-tags");
	const sortSelect = document.querySelector("#sort-select");
	const overallProgress = document.querySelector("#overall-progress");
	const overallProgressLabel = document.querySelector("#overall-progress-label");
	const dialogTitle = document.querySelector("#dialog-title");
	const formError = document.querySelector("#form-error");
	const addTaskButton = document.querySelector("#add-task-button");
	const dialogClose = document.querySelector("#dialog-close");
	const dialogCancel = document.querySelector("#dialog-cancel");
	const toast = document.querySelector("#toast");
	const toastMessage = document.querySelector("#toast-message");
	const toastUndo = document.querySelector("#toast-undo");
	const themeToggle = document.querySelector("#theme-toggle");
	const menuToggle = document.querySelector(".menu-toggle");
	const sidebar = document.querySelector(".app-sidebar");
	const exportButton = document.querySelector("#export-button");
	const importButton = document.querySelector("#import-button");
	const importFile = document.querySelector("#import-file");
	const totalTaskStat = document.querySelector("#total-task-stat");
	const completedTodayStat = document.querySelector("#completed-today-stat");
	const overdueStat = document.querySelector("#overdue-stat");
	const categoryStats = document.querySelector("#category-stats");
	const dependencyInput = document.querySelector("#task-dependencies");
	const timelineView = document.querySelector("#timeline-view");
	const listViewButton = document.querySelector("#list-view-button");
	const boardViewButton = document.querySelector("#board-view-button");
	const calendarViewButton = document.querySelector("#calendar-view-button");
	const calendarView = document.querySelector("#calendar-view");
	const calendarGridView = document.querySelector("#calendar-grid-view");
	const monthCalendarButton = document.querySelector("#month-calendar-button");
	const weekCalendarButton = document.querySelector("#week-calendar-button");
	const matrixViewButton = document.querySelector("#matrix-view-button");
	const matrixView = document.querySelector("#matrix-view");
	const matrixGrid = document.querySelector("#matrix-grid");
	const listView = document.querySelector(".task-list-section");
	const boardView = document.querySelector("#board-view");
	const boardGrid = document.querySelector("#board-grid");
	const timelineSection = timelineView?.closest(".timeline-section");
	const saveFilterButton = document.querySelector("#save-filter-button");
	const savedFiltersList = document.querySelector("#saved-filters-list");
	const pomodoroTask = document.querySelector("#pomodoro-task");
	const pomodoroMode = document.querySelector("#pomodoro-mode");
	const pomodoroTime = document.querySelector("#pomodoro-time");
	const pomodoroStart = document.querySelector("#pomodoro-start");
	const pomodoroReset = document.querySelector("#pomodoro-reset");
	const pomodoroStatus = document.querySelector("#pomodoro-status");
	const notificationButton = document.querySelector("#notification-button");
	const notificationStatus = document.querySelector("#notification-status");
	const autoScheduleSetting = document.querySelector("#auto-schedule-setting");
	const defaultBlockDuration = document.querySelector("#default-block-duration");
	const quickCaptureDialog = document.querySelector("#quick-capture-dialog");
	const quickCaptureForm = document.querySelector("#quick-capture-form");
	const quickCaptureInput = document.querySelector("#quick-capture-input");
	const quickCaptureCancel = document.querySelector("#quick-capture-cancel");
	if (
		!taskList ||
		!taskDialog ||
		!taskForm ||
		!titleInput ||
		!descriptionInput ||
		!priorityInput ||
		!dueDateInput ||
		!dueTimeInput ||
		!durationInput ||
		!autoPomodoroInput ||
		!recurrenceTypeInput ||
		!recurrenceOptions ||
		!recurrenceIntervalInput ||
		!recurrenceUnitInput ||
		!weeklyDays ||
		!categoryInput ||
		!categoryOptions ||
		!categoryList ||
		!searchInput ||
		!quickAddInput ||
		!quickAddButton ||
		!statusFilter ||
		!priorityFilter ||
		!categoryFilter ||
		!tagFilter ||
		!tagsInput ||
		!sortSelect ||
		!overallProgress ||
		!overallProgressLabel ||
		!toast ||
		!toastMessage ||
		!toastUndo ||
		!themeToggle ||
		!menuToggle ||
		!sidebar ||
		!exportButton ||
		!importButton ||
		!importFile ||
		!totalTaskStat ||
		!completedTodayStat ||
		!overdueStat ||
		!categoryStats
		|| !dependencyInput
		|| !timelineView
		|| !listViewButton
		|| !boardViewButton
		|| !calendarViewButton
		|| !calendarView
		|| !calendarGridView
		|| !monthCalendarButton
		|| !weekCalendarButton
		|| !matrixViewButton
		|| !matrixView
		|| !matrixGrid
		|| !listView
		|| !boardView
		|| !boardGrid
		|| !timelineSection
		|| !saveFilterButton
		|| !savedFiltersList
		|| !pomodoroTask
		|| !pomodoroMode
		|| !pomodoroTime
		|| !pomodoroStart
		|| !pomodoroReset
		|| !pomodoroStatus
		|| !notificationButton
		|| !notificationStatus
		|| !autoScheduleSetting
		|| !defaultBlockDuration
		|| !quickCaptureDialog
		|| !quickCaptureForm
		|| !quickCaptureInput
		|| !quickCaptureCancel
	) {
		return;
	}

	const taskManager = new TaskManager();
	const currentSettings = taskManager.getSettings();
	autoScheduleSetting.checked = currentSettings.autoStartPomodoroOnSchedule !== false;
	defaultBlockDuration.value = String(currentSettings.defaultBlockDurationMin ?? 30);
	function addQuickTask() {
		if (!quickAddInput.value.trim()) return;
		try {
			const parsed = parseQuickAdd(quickAddInput.value);
			const createdTask = taskManager.addTask({ ...parsed, dueDate: null, dueTime: null, durationMin: null });
			if (parsed.dueDate || parsed.dueTime || parsed.durationMin) {
				taskManager.setSchedule(createdTask.id, { date: parsed.dueDate, time: parsed.dueTime, durationMin: parsed.durationMin });
			}
			quickAddInput.value = "";
			renderTasks();
			showToast("Task cepat berhasil ditambahkan.");
		} catch (error) {
			showToast(`Quick-add gagal: ${error.message}`);
		}
	}
	quickAddButton.addEventListener("click", addQuickTask);
	quickAddInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			addQuickTask();
		}
	});
	function openQuickCapture() {
		quickCaptureDialog.showModal();
		quickCaptureInput.focus();
	}
	function submitQuickCapture() {
		if (!quickCaptureInput.value.trim()) return;
		try {
			const parsed = parseQuickAdd(quickCaptureInput.value);
			const createdTask = taskManager.addTask({ ...parsed, dueDate: null, dueTime: null, durationMin: null });
			if (parsed.dueDate || parsed.dueTime || parsed.durationMin) taskManager.setSchedule(createdTask.id, { date: parsed.dueDate, time: parsed.dueTime, durationMin: parsed.durationMin });
			quickCaptureInput.value = "";
			quickCaptureDialog.close();
			renderTasks();
			showToast("Task quick capture berhasil ditambahkan.");
		} catch (error) {
			showToast(`Quick capture gagal: ${error.message}`);
		}
	}
	quickCaptureForm.addEventListener("submit", (event) => {
		event.preventDefault();
		submitQuickCapture();
	});
	quickCaptureCancel.addEventListener("click", () => quickCaptureDialog.close());
	function updateNotificationStatus() {
		if (!supportsNotifications()) {
			notificationStatus.textContent = "Browser ini tidak mendukung notifikasi.";
			notificationButton.disabled = true;
			return;
		}
		if (Notification.permission === "granted") {
			notificationStatus.textContent = "Reminder H-1 aktif selama tab/PWA berjalan.";
			notificationButton.textContent = "Reminder aktif";
			return;
		}
		if (Notification.permission === "denied") {
			notificationStatus.textContent = "Izin ditolak. Ubah izin notifikasi dari pengaturan browser.";
			notificationButton.disabled = true;
		}
	}
	updateNotificationStatus();
	notificationButton.addEventListener("click", async () => {
		const permission = await requestNotificationPermission();
		updateNotificationStatus();
		if (permission === "granted") {
			scheduleTaskReminders(taskManager.getTasks());
			showToast("Reminder deadline diaktifkan.");
		}
	});
	const pomodoroTimer = new PomodoroTimer({
		workMinutes: currentSettings.pomodoroWorkMin ?? 25,
		breakMinutes: currentSettings.pomodoroBreakMin ?? 5,
		onTick: (state) => {
			pomodoroTime.textContent = formatTimer(state.remainingSeconds);
			pomodoroStart.textContent = state.running ? "Jeda" : "Mulai";
			pomodoroStatus.textContent = state.running ? (state.mode === "work" ? "Sedang fokus" : "Sedang istirahat") : "Siap fokus";
		},
		onComplete: (session) => {
			taskManager.addPomodoroSession({ ...session, startedAt: Date.now(), completed: true });
			showToast(session.mode === "work" ? "Sesi fokus selesai." : "Waktu istirahat selesai.");
		},
	});
	const scheduleScheduler = new ScheduleScheduler({
		getTasks: () => taskManager.getTasks(),
		getSettings: () => taskManager.getSettings(),
		pomodoroTimer,
		onMissed: (task) => {
			if (window.confirm(`${task.title} harusnya mulai jam ${task.dueTime}. Mulai Pomodoro sekarang?`)) {
				pomodoroTimer.setTask(task.id);
				pomodoroTimer.start();
			}
		},
		 onStarted: (task) => showToast(`Pomodoro otomatis dimulai: ${task.title}`),
	});
	autoScheduleSetting.addEventListener("change", () => {
		taskManager.updateSettings({ autoStartPomodoroOnSchedule: autoScheduleSetting.checked });
		scheduleScheduler.schedule();
	});
	defaultBlockDuration.addEventListener("change", () => {
		const value = Math.max(15, Number(defaultBlockDuration.value) || 30);
		defaultBlockDuration.value = String(value);
		taskManager.updateSettings({ defaultBlockDurationMin: value });
	});
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") scheduleScheduler.syncOnVisibility();
	});

	function renderPomodoroTasks(tasks) {
		const selectedTaskId = pomodoroTask.value;
		pomodoroTask.replaceChildren();
		const emptyOption = document.createElement("option");
		emptyOption.value = "";
		emptyOption.textContent = "Tanpa task";
		pomodoroTask.append(emptyOption);
		tasks.filter((task) => !task.completed && !task.archived).forEach((task) => {
			const option = document.createElement("option");
			option.value = task.id;
			option.textContent = task.title;
			option.selected = task.id === selectedTaskId;
			pomodoroTask.append(option);
		});
	}

	pomodoroTask.addEventListener("change", () => pomodoroTimer.setTask(pomodoroTask.value));
	pomodoroMode.addEventListener("change", () => pomodoroTimer.setMode(pomodoroMode.value));
	pomodoroStart.addEventListener("click", () => {
		if (pomodoroTimer.getState().running) pomodoroTimer.pause();
		else pomodoroTimer.start();
	});
	pomodoroReset.addEventListener("click", () => pomodoroTimer.reset());
	menuToggle.addEventListener("click", () => {
		const isOpen = sidebar.classList.toggle("is-open");
		menuToggle.setAttribute("aria-expanded", String(isOpen));
		menuToggle.setAttribute("aria-label", isOpen ? "Tutup menu navigasi" : "Buka menu navigasi");
	});

	/**
	 * Menampilkan toast informasi tanpa opsi undo.
	 * @param {string} message Pesan yang ditampilkan.
	 */
	function showToast(message) {
		deletedTask = null;
		clearTimeout(toastTimer);
		toastMessage.textContent = message;
		toastUndo.hidden = true;
		toast.hidden = false;
		toastTimer = setTimeout(() => {
			toast.hidden = true;
		}, 3500);
	}

	exportButton.addEventListener("click", () => {
		const exportData = { ...taskManager.getStore(), schemaVersion: CURRENT_SCHEMA_VERSION };
		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		});
		const downloadUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = downloadUrl;
		link.download = `task-manager-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(downloadUrl);
		showToast("Data berhasil diexport.");
	});

	importButton.addEventListener("click", () => importFile.click());
	importFile.addEventListener("change", async () => {
		const [file] = importFile.files;
		if (!file) {
			return;
		}
		try {
			const importedData = JSON.parse(await file.text());
			const validatedStore = validateImportData(importedData);
			taskManager.replaceStore(validatedStore);
			showToast("Data berhasil diimport.");
			renderTasks();
		} catch (error) {
			showToast(`Import gagal: ${error.message}`);
		} finally {
			importFile.value = "";
		}
	});
	themeToggle.addEventListener("click", () => {
		const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
		localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
		applyTheme(nextTheme);
	});
	let editingTaskId = null;
	let deletedTask = null;
	let toastTimer = null;
	let draggedTaskId = null;
	let activeView = "list";
	let calendarMonth = new Date();
	let calendarWeekDate = new Date();
	let calendarMode = "month";

	/**
	 * Merender task nyata atau dummy ketika storage masih kosong.
	 */
	function renderTasks() {
		const tasks = taskManager.getTasks();
		renderCategories(tasks);
		renderSavedFilters();
		renderStatistics(tasks);
		renderPomodoroTasks(tasks);
		scheduleScheduler.schedule();
		scheduleTaskReminders(tasks);
		renderTimeline(timelineView, tasks);
		const completedCount = tasks.filter((task) => task.completed).length;
		const progressValue = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
		overallProgress.value = progressValue;
		overallProgressLabel.textContent = `${progressValue}% (${completedCount}/${tasks.length})`;
		const visibleTasks = filterAndSortTasks(tasks, {
			query: searchInput.value,
			status: statusFilter.value,
			priority: priorityFilter.value,
			category: categoryFilter.value,
			tags: [...tagFilter.selectedOptions].map((option) => option.value),
			sort: sortSelect.value,
		});
		const emptyMessage = tasks.length === 0
			? "Belum ada tugas. Tambahkan tugas pertamamu."
			: "Tidak ada tugas yang cocok dengan filter saat ini.";
		renderTaskList(taskList, visibleTasks, emptyMessage);
		renderBoard(boardGrid, visibleTasks);
		if (calendarMode === "month") {
			renderCalendar(calendarGridView, tasks, calendarMonth, (date) => {
				calendarWeekDate = new Date(`${date}T00:00:00`);
				calendarMode = "week";
				renderTasks();
			}, (task) => openTaskDialog(task));
		} else {
			renderWeekCalendar(calendarGridView, tasks, calendarWeekDate, (task) => openTaskDialog(task));
		}
		monthCalendarButton.classList.toggle("is-selected", calendarMode === "month");
		weekCalendarButton.classList.toggle("is-selected", calendarMode === "week");
		renderMatrix(matrixGrid, tasks);
		listView.hidden = activeView !== "list";
		boardView.hidden = activeView !== "board";
		calendarView.hidden = activeView !== "calendar";
		matrixView.hidden = activeView !== "matrix";
		timelineSection.hidden = activeView !== "list";
		listViewButton.classList.toggle("is-selected", activeView === "list");
		boardViewButton.classList.toggle("is-selected", activeView === "board");
		calendarViewButton.classList.toggle("is-selected", activeView === "calendar");
		matrixViewButton.classList.toggle("is-selected", activeView === "matrix");
	}

	listViewButton.addEventListener("click", () => {
		activeView = "list";
		renderTasks();
	});
	boardViewButton.addEventListener("click", () => {
		activeView = "board";
		renderTasks();
	});
	calendarViewButton.addEventListener("click", () => {
		activeView = "calendar";
		renderTasks();
	});
	monthCalendarButton.addEventListener("click", () => { calendarMode = "month"; renderTasks(); });
	weekCalendarButton.addEventListener("click", () => { calendarMode = "week"; renderTasks(); });
	matrixViewButton.addEventListener("click", () => {
		activeView = "matrix";
		renderTasks();
	});

	matrixGrid.addEventListener("dragstart", (event) => {
		const card = event.target.closest("[data-task-id]");
		if (!card) return;
		draggedTaskId = card.dataset.taskId;
		card.classList.add("is-dragging");
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", draggedTaskId);
	});
	matrixGrid.addEventListener("dragover", (event) => {
		if (draggedTaskId && event.target.closest("[data-matrix-dropzone]")) event.preventDefault();
	});
	matrixGrid.addEventListener("drop", (event) => {
		const dropzone = event.target.closest("[data-matrix-dropzone]");
		if (!draggedTaskId || !dropzone) return;
		event.preventDefault();
		const task = taskManager.getTasks().find((item) => item.id === draggedTaskId);
		if (!task || getTaskQuadrant(task) === dropzone.dataset.matrixDropzone) return;
		if (!window.confirm("Ubah prioritas/deadline task agar sesuai kuadran baru?")) return;
		const [urgency, importance] = dropzone.dataset.matrixDropzone.split("-");
		const changes = {
			priority: importance === "important" ? (task.priority === "low" ? "medium" : task.priority) : "low",
			dueDate: urgency === "urgent"
				? (task.dueDate ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))
				: null,
		};
		taskManager.updateTask(task.id, changes);
		draggedTaskId = null;
		renderTasks();
	});
	matrixGrid.addEventListener("dragend", () => {
		draggedTaskId = null;
		matrixGrid.querySelectorAll(".is-dragging").forEach((card) => card.classList.remove("is-dragging"));
	});

	calendarGridView.addEventListener("click", (event) => {
		if (event.target.closest("[data-calendar-previous]")) {
			calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
			renderTasks();
			return;
		}
		if (event.target.closest("[data-calendar-next]")) {
			calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
			renderTasks();
			return;
		}
		const taskButton = event.target.closest("[data-calendar-task-id]");
		if (taskButton) {
			const task = taskManager.getTasks().find((item) => item.id === taskButton.dataset.calendarTaskId);
			if (task) openTaskDialog(task);
			return;
		}
		const dateButton = event.target.closest("[data-calendar-date]");
		if (dateButton) openTaskDialog(null, dateButton.dataset.calendarDate);
	});

	calendarGridView.addEventListener("pointerdown", (event) => {
		const block = event.target.closest("[data-calendar-task-id]");
		if (!block || !calendarMode || calendarMode !== "week") return;
		const resizeHandle = event.target.closest("[data-resize-task-id]");
		const taskId = resizeHandle?.dataset.resizeTaskId ?? block.dataset.calendarTaskId;
		const task = taskManager.getTasks().find((item) => item.id === taskId);
		if (!task) return;
		const startY = event.clientY;
		const startX = event.clientX;
		const originalDuration = task.durationMin ?? 30;
		const originalDate = task.dueDate;
		const originalTime = task.dueTime;
		const onMove = (moveEvent) => {
			if (resizeHandle) return;
			const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest("[data-week-date]");
			if (target) block.dataset.previewDate = target.dataset.weekDate;
		};
		const onUp = (upEvent) => {
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
			if (resizeHandle) {
				const duration = Math.max(15, Math.round((originalDuration + (upEvent.clientY - startY) / 56 * 60) / 15) * 15);
				taskManager.setSchedule(task.id, { date: originalDate, time: originalTime, durationMin: duration });
			} else if (block.dataset.previewDate) {
				const target = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest("[data-week-date]");
				if (target) taskManager.setSchedule(task.id, { date: target.dataset.weekDate, time: target.dataset.weekTime, durationMin: originalDuration });
			}
			renderTasks();
		};
		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp, { once: true });
	});

	boardGrid.addEventListener("dragstart", (event) => {
		const card = event.target.closest("[data-task-id]");
		if (!card) return;
		draggedTaskId = card.dataset.taskId;
		card.classList.add("is-dragging");
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", draggedTaskId);
	});
	boardGrid.addEventListener("dragover", (event) => {
		if (draggedTaskId && event.target.closest("[data-board-status]")) event.preventDefault();
	});
	boardGrid.addEventListener("drop", (event) => {
		const zone = event.target.closest("[data-board-status]");
		if (!draggedTaskId || !zone) return;
		event.preventDefault();
		const shouldComplete = zone.dataset.boardStatus === "completed";
		const task = taskManager.getTasks().find((item) => item.id === draggedTaskId);
		if (task && task.completed !== shouldComplete) {
			if (shouldComplete) {
				try {
					taskManager.completeTask(task.id);
				} catch (error) {
					if (window.confirm(`${error.message}. Tetap pindahkan ke Selesai?`)) {
						taskManager.completeTask(task.id, true);
					}
				}
			} else {
				taskManager.setCompleted(task.id, false);
			}
		}
		draggedTaskId = null;
		renderTasks();
	});
	boardGrid.addEventListener("dragend", () => {
		draggedTaskId = null;
		boardGrid.querySelectorAll(".is-dragging").forEach((card) => card.classList.remove("is-dragging"));
	});

	boardGrid.addEventListener("change", (event) => {
		const checkbox = event.target.closest("input[type='checkbox']");
		const card = event.target.closest("[data-task-id]");
		if (!checkbox || !card || checkbox.dataset.subtaskId) return;
		if (checkbox.checked) {
			try {
				taskManager.completeTask(card.dataset.taskId);
			} catch (error) {
				if (window.confirm(`${error.message}. Tetap tandai selesai?`)) taskManager.completeTask(card.dataset.taskId, true);
			}
		} else {
			taskManager.setCompleted(card.dataset.taskId, false);
		}
		renderTasks();
	});

	boardGrid.addEventListener("click", (event) => {
		const actionButton = event.target.closest("[data-action]");
		const card = event.target.closest("[data-task-id]");
		if (!actionButton || !card) return;
		const task = taskManager.getTasks().find((item) => item.id === card.dataset.taskId);
		if (!task) return;
		if (actionButton.dataset.action === "edit") {
			openTaskDialog(task);
		} else if (actionButton.dataset.action === "delete" && window.confirm(`Hapus tugas "${task.title}"?`)) {
			showDeleteToast(taskManager.deleteTask(task.id));
			renderTasks();
		}
		if (actionButton.dataset.action === "archive" || actionButton.dataset.action === "unarchive") {
			taskManager.setArchived(task.id, actionButton.dataset.action === "archive");
			renderTasks();
			showToast(actionButton.dataset.action === "archive" ? "Task diarsipkan." : "Task dipulihkan.");
			return;
		}
	});

	/**
	 * Mengambil filter aktif dari kontrol toolbar.
	 * @returns {object} Kriteria filter yang dapat disimpan.
	 */
	function getCurrentFilterCriteria() {
		return {
			query: searchInput.value,
			status: statusFilter.value,
			priority: priorityFilter.value,
			category: categoryFilter.value,
			tags: [...tagFilter.selectedOptions].map((option) => option.value),
			sort: sortSelect.value,
		};
	}

	/**
	 * Merender filter tersimpan di sidebar.
	 */
	function renderSavedFilters() {
		savedFiltersList.replaceChildren();
		taskManager.getSavedFilters().forEach((savedFilter) => {
			const item = document.createElement("li");
			const applyButton = document.createElement("button");
			applyButton.type = "button";
			applyButton.className = "saved-filter-apply";
			applyButton.dataset.filterId = savedFilter.id;
			applyButton.textContent = savedFilter.name;
			const deleteButton = document.createElement("button");
			deleteButton.type = "button";
			deleteButton.className = "saved-filter-delete";
			deleteButton.dataset.deleteFilterId = savedFilter.id;
			deleteButton.setAttribute("aria-label", `Hapus filter ${savedFilter.name}`);
			deleteButton.textContent = "×";
			item.append(applyButton, deleteButton);
			savedFiltersList.append(item);
		});
	}

	/**
	 * Menerapkan kriteria filter tersimpan ke toolbar.
	 * @param {object} criteria Kriteria filter.
	 */
	function applySavedFilter(criteria) {
		searchInput.value = criteria.query ?? "";
		statusFilter.value = criteria.status ?? "all";
		priorityFilter.value = criteria.priority ?? "all";
		categoryFilter.value = criteria.category ?? "all";
		sortSelect.value = criteria.sort ?? "order";
		const tags = new Set(criteria.tags ?? []);
		[...tagFilter.options].forEach((option) => {
			option.selected = tags.has(option.value);
		});
		renderTasks();
	}

	/**
	 * Menghitung statistik dashboard dari task yang tersimpan.
	 * @param {Array<object>} tasks Task yang tersedia.
	 */
	function renderStatistics(tasks) {
		const today = new Date().toISOString().slice(0, 10);
		const completedToday = tasks.filter(
			(task) => task.completedAt && new Date(task.completedAt).toISOString().slice(0, 10) === today,
		).length;
		const overdue = tasks.filter(
			(task) => !task.completed && task.dueDate && task.dueDate < today,
		).length;
		const categoryCounts = new Map();
		tasks.forEach((task) => {
			if (task.category) {
				categoryCounts.set(task.category, (categoryCounts.get(task.category) ?? 0) + 1);
			}
		});
		totalTaskStat.textContent = String(tasks.length);
		completedTodayStat.textContent = String(completedToday);
		overdueStat.textContent = String(overdue);
		categoryStats.replaceChildren();
		if (categoryCounts.size === 0) {
			categoryStats.textContent = "Belum ada data.";
			return;
		}
		[...categoryCounts.entries()].sort().forEach(([category, count]) => {
			const item = document.createElement("span");
			item.textContent = `${category}: ${count}`;
			categoryStats.append(item);
		});
	}

	/**
	 * Menampilkan kategori unik pada sidebar dan datalist form.
	 * @param {Array<object>} tasks Task yang tersedia.
	 */
	function renderCategories(tasks) {
		const categories = [...new Set(tasks.map((task) => task.category).filter(Boolean))].sort();
		categoryOptions.replaceChildren();
		categories.forEach((category) => {
			const option = document.createElement("option");
			option.value = category;
			categoryOptions.append(option);
		});
		const selectedCategory = categoryFilter.value;
		categoryFilter.replaceChildren();
		const allCategoriesOption = document.createElement("option");
		allCategoriesOption.value = "all";
		allCategoriesOption.textContent = "Semua";
		categoryFilter.append(allCategoriesOption);
		categories.forEach((category) => {
			const option = document.createElement("option");
			option.value = category;
			option.textContent = category;
			categoryFilter.append(option);
		});
		categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : "all";
		const selectedTags = new Set([...tagFilter.selectedOptions].map((option) => option.value));
		const tags = [...new Set([...tasks.flatMap((task) => task.tags ?? []), ...selectedTags])].sort();
		tagFilter.replaceChildren();
		tags.forEach((tag) => {
			const option = document.createElement("option");
			option.value = tag;
			option.textContent = `#${tag}`;
			option.selected = selectedTags.has(tag);
			tagFilter.append(option);
		});

		categoryList.querySelector("p")?.remove();
		categoryList.querySelector("ul")?.remove();
		if (categories.length === 0) {
			const emptyMessage = document.createElement("p");
			emptyMessage.textContent = "Belum ada kategori.";
			categoryList.append(emptyMessage);
			return;
		}

		const list = document.createElement("ul");
		categories.forEach((category) => {
			const item = document.createElement("li");
			item.textContent = category;
			list.append(item);
		});
		categoryList.append(list);
	}

	/**
	 * Membuka modal dalam mode tambah atau edit.
	 * @param {object|null} task Task yang diedit, atau null untuk task baru.
	 */
	function openTaskDialog(task = null, prefilledDueDate = null) {
		editingTaskId = task?.id ?? null;
		dialogTitle.textContent = editingTaskId ? "Edit tugas" : "Tambah tugas";
		titleInput.value = task?.title ?? "";
		descriptionInput.value = task?.description ?? "";
		priorityInput.value = task?.priority ?? "medium";
		dueDateInput.value = task?.dueDate ?? prefilledDueDate ?? "";
		dueTimeInput.value = task?.dueTime ?? "";
		durationInput.value = task?.durationMin ? String(task.durationMin) : "";
		autoPomodoroInput.checked = task?.autoPomodoro !== false;
		const recurrence = task?.recurrence ?? null;
		recurrenceTypeInput.value = recurrence?.type ?? "none";
		recurrenceIntervalInput.value = recurrence?.interval ?? 1;
		recurrenceUnitInput.value = recurrence?.unit ?? "days";
		weeklyDays.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
			checkbox.checked = recurrence?.daysOfWeek?.includes(Number(checkbox.value)) ?? false;
		});
		updateRecurrenceControls();
		categoryInput.value = task?.category ?? "";
		tagsInput.value = task?.tags?.join(", ") ?? "";
		dependencyInput.replaceChildren();
		taskManager.getTasks().filter((candidate) => candidate.id !== editingTaskId).forEach((candidate) => {
			const option = document.createElement("option");
			option.value = candidate.id;
			option.textContent = candidate.title;
			option.selected = task?.dependsOn?.includes(candidate.id) ?? false;
			dependencyInput.append(option);
		});
		formError.hidden = true;
		taskDialog.showModal();
		titleInput.focus();
	}

	/**
	 * Mengambil konfigurasi recurring dari kontrol form.
	 * @returns {object|null} Konfigurasi recurring atau null.
	 */
	function readRecurrence() {
		if (recurrenceTypeInput.value === "none") {
			return null;
		}
		return {
			type: recurrenceTypeInput.value,
			interval: Number(recurrenceIntervalInput.value) || 1,
			unit: recurrenceUnitInput.value,
			daysOfWeek: [...weeklyDays.querySelectorAll("input:checked")].map((input) => Number(input.value)),
		};
	}

	/**
	 * Menampilkan kontrol interval dan hari yang relevan.
	 */
	function updateRecurrenceControls() {
		const enabled = recurrenceTypeInput.value !== "none";
		recurrenceOptions.hidden = !enabled;
		weeklyDays.hidden = recurrenceTypeInput.value !== "weekly";
		recurrenceUnitInput.hidden = recurrenceTypeInput.value !== "custom";
	}

	recurrenceTypeInput.addEventListener("change", updateRecurrenceControls);

	/**
	 * Menutup modal dan mengosongkan status edit.
	 */
	function closeTaskDialog() {
		taskDialog.close();
		editingTaskId = null;
		taskForm.reset();
	}

	/**
	 * Menampilkan notifikasi sementara dan opsi undo untuk task yang dihapus.
	 * @param {object} task Task yang dapat dipulihkan.
	 */
	function showDeleteToast(task) {
		deletedTask = task;
		toastMessage.textContent = `Tugas "${task.title}" dihapus.`;
		toastUndo.hidden = false;
		toast.hidden = false;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			deletedTask = null;
			toast.hidden = true;
		}, 5000);
	}

	toastUndo.addEventListener("click", () => {
		if (!deletedTask) {
			return;
		}
		taskManager.restoreTask(deletedTask);
		deletedTask = null;
		clearTimeout(toastTimer);
		toast.hidden = true;
		renderTasks();
	});

	const debouncedSearch = debounce(renderTasks, 300);
	searchInput.addEventListener("input", debouncedSearch);
	[statusFilter, priorityFilter, categoryFilter, sortSelect].forEach((control) => {
		control.addEventListener("change", renderTasks);
	});
	tagFilter.addEventListener("change", renderTasks);

	saveFilterButton.addEventListener("click", () => {
		const name = window.prompt("Nama filter tersimpan:");
		if (!name?.trim()) {
			return;
		}
		taskManager.addSavedFilter(name, getCurrentFilterCriteria());
		renderSavedFilters();
		showToast("Filter berhasil disimpan.");
	});

	savedFiltersList.addEventListener("click", (event) => {
		const applyButton = event.target.closest("[data-filter-id]");
		const deleteButton = event.target.closest("[data-delete-filter-id]");
		if (applyButton) {
			const savedFilter = taskManager
				.getSavedFilters()
				.find((filter) => filter.id === applyButton.dataset.filterId);
			if (savedFilter) {
				applySavedFilter(savedFilter.criteria);
			}
			return;
		}
		if (deleteButton) {
			taskManager.deleteSavedFilter(deleteButton.dataset.deleteFilterId);
			renderSavedFilters();
			showToast("Filter tersimpan dihapus.");
		}
	});

	document.addEventListener("keydown", (event) => {
		const activeElement = document.activeElement;
		const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(activeElement?.tagName);
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			openQuickCapture();
			return;
		}
		if (event.key === "/" && !isTyping) {
			event.preventDefault();
			searchInput.focus();
			return;
		}
		if (event.key === "Escape" && taskDialog.open) {
			closeTaskDialog();
			return;
		}
		if (event.key === "Enter" && !isTyping && !taskDialog.open) {
			event.preventDefault();
			openTaskDialog();
			return;
		}
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && deletedTask) {
			event.preventDefault();
			taskManager.restoreTask(deletedTask);
			deletedTask = null;
			clearTimeout(toastTimer);
			toast.hidden = true;
			renderTasks();
		}
	});

	/**
	 * Menentukan apakah daftar saat ini aman untuk diurutkan manual.
	 * @returns {boolean} True saat semua task terlihat.
	 */
	function canReorder() {
		return (
			!searchInput.value.trim() &&
			statusFilter.value === "all" &&
			priorityFilter.value === "all" &&
			categoryFilter.value === "all" &&
			tagFilter.selectedOptions.length === 0 &&
			sortSelect.value === "order"
		);
	}

	taskList.addEventListener("dragstart", (event) => {
		const card = event.target.closest("[data-task-id]");
		if (!card || !canReorder() || card.dataset.taskId === "demo-task") {
			event.preventDefault();
			return;
		}
		draggedTaskId = card.dataset.taskId;
		card.classList.add("is-dragging");
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", draggedTaskId);
	});

	taskList.addEventListener("dragover", (event) => {
		if (!draggedTaskId || !canReorder()) {
			return;
		}
		event.preventDefault();
		const targetCard = event.target.closest("[data-task-id]");
		if (targetCard && targetCard.dataset.taskId !== draggedTaskId) {
			targetCard.classList.add("is-drag-over");
		}
	});

	taskList.addEventListener("drop", (event) => {
		if (!draggedTaskId || !canReorder()) {
			return;
		}
		event.preventDefault();
		const targetCard = event.target.closest("[data-task-id]");
		if (!targetCard || targetCard.dataset.taskId === draggedTaskId) {
			return;
		}

		const taskIds = [...taskList.querySelectorAll("[data-task-id]")].map(
			(card) => card.dataset.taskId,
		);
		const draggedIndex = taskIds.indexOf(draggedTaskId);
		const targetIndex = taskIds.indexOf(targetCard.dataset.taskId);
		taskIds.splice(draggedIndex, 1);
		taskIds.splice(targetIndex, 0, draggedTaskId);
		taskManager.reorderTasks(taskIds);
		renderTasks();
	});

	taskList.addEventListener("dragend", () => {
		draggedTaskId = null;
		taskList.querySelectorAll(".is-dragging, .is-drag-over").forEach((card) => {
			card.classList.remove("is-dragging", "is-drag-over");
		});
	});

	addTaskButton?.addEventListener("click", () => openTaskDialog());
	dialogClose?.addEventListener("click", closeTaskDialog);
	dialogCancel?.addEventListener("click", closeTaskDialog);

	taskForm.addEventListener("submit", (event) => {
		event.preventDefault();
		try {
			const schedule = {
				date: dueDateInput.value || null,
				time: dueTimeInput.value || null,
				durationMin: durationInput.value ? Number(durationInput.value) : null,
			};
			const conflicts = taskManager.getScheduleConflicts(editingTaskId, schedule.date, schedule.time, schedule.durationMin);
			if (conflicts.length > 0 && !window.confirm(`Bentrok dengan: ${conflicts.map((task) => task.title).join(", ")}. Tetap simpan?`)) return;
			const input = {
				title: titleInput.value,
				description: descriptionInput.value,
				priority: priorityInput.value,
				dueDate: null,
				dueTime: null,
				durationMin: null,
				autoPomodoro: autoPomodoroInput.checked,
				recurrence: readRecurrence(),
				category: categoryInput.value,
				tags: tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean),
				dependsOn: [...dependencyInput.selectedOptions].map((option) => option.value),
			};
			if (editingTaskId) {
				taskManager.updateTask(editingTaskId, input);
				taskManager.setSchedule(editingTaskId, { ...schedule, autoPomodoro: autoPomodoroInput.checked });
			} else {
				const createdTask = taskManager.addTask(input);
				taskManager.setSchedule(createdTask.id, { ...schedule, autoPomodoro: autoPomodoroInput.checked });
			}
			closeTaskDialog();
			renderTasks();
		} catch (error) {
			formError.textContent = error.message;
			formError.hidden = false;
		}
	});

	taskList.addEventListener("change", (event) => {
		const subtaskCheckbox = event.target.closest("[data-subtask-id]");
		const subtaskCard = event.target.closest("[data-task-id]");
		if (subtaskCheckbox && subtaskCard) {
			taskManager.setSubtaskCompleted(
				subtaskCard.dataset.taskId,
				subtaskCheckbox.dataset.subtaskId,
				subtaskCheckbox.checked,
			);
			renderTasks();
			return;
		}
		const checkbox = event.target.closest("input[type='checkbox']");
		const card = event.target.closest("[data-task-id]");
		if (!checkbox || !card) {
			return;
		}
		if (checkbox.checked) {
			let completion;
			try {
				completion = taskManager.completeTask(card.dataset.taskId);
			} catch (error) {
				if (!window.confirm(`${error.message}. Tetap tandai selesai?`)) {
					checkbox.checked = false;
					return;
				}
				completion = taskManager.completeTask(card.dataset.taskId, true);
			}
			if (completion.nextTask) {
				showToast("Task berulang selesai. Occurrence berikutnya dibuat.");
			}
		} else {
			taskManager.setCompleted(card.dataset.taskId, false);
		}
		renderTasks();
	});

	taskList.addEventListener("submit", (event) => {
		const subtaskForm = event.target.closest("[data-subtask-input]")?.closest("form");
		const card = event.target.closest("[data-task-id]");
		if (!subtaskForm || !card) {
			return;
		}
		event.preventDefault();
		const input = subtaskForm.querySelector("[data-subtask-input]");
		try {
			taskManager.addSubtask(
				card.dataset.taskId,
				input.value,
				subtaskForm.dataset.parentSubtaskId || null,
			);
			input.value = "";
			renderTasks();
		} catch {
			input.focus();
		}
	});

	taskList.addEventListener("click", (event) => {
		const actionButton = event.target.closest("[data-action]");
		const card = event.target.closest("[data-task-id]");
		if (!actionButton || !card) {
			return;
		}

		const task = taskManager.getTasks().find((item) => item.id === card.dataset.taskId);
		if (!task) {
			return;
		}

		if (actionButton.dataset.action === "edit") {
			openTaskDialog(task);
			return;
		}

		if (actionButton.dataset.action === "delete" && window.confirm(`Hapus tugas "${task.title}"?`)) {
			const removedTask = taskManager.deleteTask(task.id);
			renderTasks();
			showDeleteToast(removedTask);
		}
	});

	renderTasks();
}

initializeApp();
