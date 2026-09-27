import { sendNotification } from "./notifications.js";

/**
 * Menjadwalkan auto-start Pomodoro untuk task terdekat.
 */
export class ScheduleScheduler {
	/**
	 * @param {{getTasks: Function, getSettings: Function, pomodoroTimer: object, onMissed: Function, onStarted: Function}} dependencies Dependency scheduler.
	 */
	constructor({ getTasks, getSettings, pomodoroTimer, onMissed = () => {}, onStarted = () => {} }) {
		this.getTasks = getTasks;
		this.getSettings = getSettings;
		this.pomodoroTimer = pomodoroTimer;
		this.onMissed = onMissed;
		this.onStarted = onStarted;
		this.timeoutId = null;
		this.scheduledTaskId = null;
		this.lastSyncAt = Date.now();
	}

	/**
	 * Menjadwalkan hanya satu trigger untuk task terdekat.
	 */
	schedule() {
		if (this.timeoutId !== null) clearTimeout(this.timeoutId);
		this.timeoutId = null;
		this.scheduledTaskId = null;
		const settings = this.getSettings();
		if (settings.autoStartPomodoroOnSchedule === false) return;
		const now = Date.now();
		const nextTask = this.getTasks()
			.filter((task) => !task.completed && !task.archived && task.autoPomodoro !== false && task.dueDate && task.dueTime)
			.map((task) => ({ task, timestamp: Date.parse(`${task.dueDate}T${task.dueTime}:00`) }))
			.filter((item) => Number.isFinite(item.timestamp) && item.timestamp > now)
			.sort((first, second) => first.timestamp - second.timestamp)[0];
		if (!nextTask) return;
		this.scheduledTaskId = nextTask.task.id;
		this.timeoutId = setTimeout(() => this.trigger(nextTask.task), nextTask.timestamp - now);
	}

	/**
	 * Menjalankan trigger pada waktu task.
	 * @param {object} task Task terjadwal.
	 */
	trigger(task) {
		this.timeoutId = null;
		this.scheduledTaskId = null;
		if (this.pomodoroTimer.getState().running) {
			this.onMissed(task);
			this.schedule();
			return;
		}
		this.pomodoroTimer.setTask(task.id);
		this.pomodoroTimer.start();
		sendNotification("Pomodoro otomatis dimulai", { body: `🍅 ${task.title} dimulai — Pomodoro otomatis`, tag: `pomodoro-${task.id}` });
		this.onStarted(task);
		this.schedule();
	}

	/**
	 * Menangani tab kembali aktif dan menawarkan task yang terlewat.
	 */
	syncOnVisibility() {
		const now = Date.now();
		const elapsed = now - this.lastSyncAt;
		this.lastSyncAt = now;
		if (elapsed < 5000) return;
		const missed = this.getTasks()
			.filter((task) => !task.completed && !task.archived && task.autoPomodoro !== false && task.dueDate && task.dueTime)
			.map((task) => ({ task, timestamp: Date.parse(`${task.dueDate}T${task.dueTime}:00`) }))
			.filter((item) => item.timestamp <= now && item.timestamp > now - elapsed)
			.sort((first, second) => second.timestamp - first.timestamp)[0];
		if (missed) this.onMissed(missed.task);
		this.schedule();
	}

	/**
	 * Membatalkan scheduler.
	 */
	destroy() {
		if (this.timeoutId !== null) clearTimeout(this.timeoutId);
		this.timeoutId = null;
	}
}
