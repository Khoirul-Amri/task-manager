const MODES = ["work", "break"];

/**
 * Timer Pomodoro yang tidak bergantung pada DOM.
 */
export class PomodoroTimer {
	/**
	 * @param {{workMinutes?: number, breakMinutes?: number, onTick?: Function, onComplete?: Function}} options Konfigurasi timer.
	 */
	constructor({ workMinutes = 25, breakMinutes = 5, onTick = () => {}, onComplete = () => {} } = {}) {
		this.durations = { work: workMinutes * 60, break: breakMinutes * 60 };
		this.mode = "work";
		this.remainingSeconds = this.durations.work;
		this.intervalId = null;
		this.taskId = null;
		this.onTick = onTick;
		this.onComplete = onComplete;
	}

	/**
	 * Memulai timer.
	 */
	start() {
		if (this.intervalId !== null) return;
		this.intervalId = setInterval(() => this.tick(), 1000);
		this.onTick(this.getState());
	}

	/**
	 * Menjeda timer.
	 */
	pause() {
		if (this.intervalId === null) return;
		clearInterval(this.intervalId);
		this.intervalId = null;
		this.onTick(this.getState());
	}

	/**
	 * Mereset timer ke mode aktif.
	 */
	reset() {
		this.pause();
		this.remainingSeconds = this.durations[this.mode];
		this.onTick(this.getState());
	}

	/**
	 * Mengganti mode kerja atau istirahat.
	 * @param {"work"|"break"} mode Mode timer.
	 */
	setMode(mode) {
		if (!MODES.includes(mode)) throw new Error("Mode Pomodoro tidak valid.");
		this.pause();
		this.mode = mode;
		this.remainingSeconds = this.durations[mode];
		this.onTick(this.getState());
	}

	/**
	 * Mengaitkan sesi dengan task.
	 * @param {string|null} taskId ID task.
	 */
	setTask(taskId) {
		this.taskId = taskId || null;
	}

	/**
	 * Mengurangi satu detik dan menyelesaikan sesi jika mencapai nol.
	 */
	tick() {
		this.remainingSeconds -= 1;
		if (this.remainingSeconds <= 0) {
			this.pause();
			this.onComplete({ mode: this.mode, taskId: this.taskId, durationMin: this.durations[this.mode] / 60 });
			this.mode = this.mode === "work" ? "break" : "work";
			this.remainingSeconds = this.durations[this.mode];
		}
		this.onTick(this.getState());
	}

	/**
	 * Mengambil state timer.
	 * @returns {{mode: string, remainingSeconds: number, running: boolean, taskId: string|null}} State timer.
	 */
	getState() {
		return {
			mode: this.mode,
			remainingSeconds: this.remainingSeconds,
			running: this.intervalId !== null,
			taskId: this.taskId,
		};
	}
}

/**
 * Memformat detik menjadi MM:SS.
 * @param {number} seconds Total detik.
 * @returns {string} Waktu terformat.
 */
export function formatTimer(seconds) {
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
