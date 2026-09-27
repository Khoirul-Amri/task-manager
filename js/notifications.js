const reminderTimers = new Map();

/**
 * Memeriksa dukungan Notification API.
 * @returns {boolean} True jika browser mendukung notifikasi.
 */
export function supportsNotifications() {
	return "Notification" in window;
}

/**
 * Meminta izin notifikasi dari browser.
 * @returns {Promise<string>} Status izin.
 */
export async function requestNotificationPermission() {
	if (!supportsNotifications()) return "unsupported";
	return Notification.requestPermission();
}

/**
 * Mengirim notifikasi jika izin tersedia.
 * @param {string} title Judul notifikasi.
 * @param {object} options Isi notifikasi.
 * @returns {Notification|null} Notifikasi atau null.
 */
export function sendNotification(title, options = {}) {
	if (!supportsNotifications() || Notification.permission !== "granted") return null;
	return new Notification(title, options);
}

/**
 * Menjadwalkan reminder H-1 pukul 09.00 untuk task yang memiliki deadline.
 * @param {Array<object>} tasks Task yang akan dijadwalkan.
 */
export function scheduleTaskReminders(tasks) {
	reminderTimers.forEach((timerId) => clearTimeout(timerId));
	reminderTimers.clear();
	if (!supportsNotifications() || Notification.permission !== "granted") return;

	const now = Date.now();
	tasks.filter((task) => !task.completed && !task.archived && task.dueDate).forEach((task) => {
		const dueDate = new Date(`${task.dueDate}T09:00:00`);
		const reminderDate = new Date(dueDate);
		reminderDate.setDate(reminderDate.getDate() - 1);
		const delay = reminderDate.getTime() - now;
		if (delay <= 0) return;
		const timerId = setTimeout(() => {
			sendNotification("Task deadline besok", { body: task.title, tag: `task-${task.id}` });
			reminderTimers.delete(task.id);
		}, delay);
		reminderTimers.set(task.id, timerId);
	});
}
