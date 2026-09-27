const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

/**
 * Memformat Date sebagai tanggal lokal tanpa pergeseran timezone.
 * @param {Date} date Tanggal lokal.
 * @returns {string} Format YYYY-MM-DD.
 */
function formatLocalDate(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Merender kalender bulanan dan task berdasarkan deadline.
 * @param {HTMLElement} container Container kalender.
 * @param {Array<object>} tasks Task yang tersedia.
 * @param {Date} monthDate Bulan yang sedang ditampilkan.
 * @param {(date: string) => void} onDateClick Callback tanggal.
 * @param {(task: object) => void} onTaskClick Callback task.
 */
export function renderCalendar(container, tasks, monthDate, onDateClick, onTaskClick) {
	container.replaceChildren();
	const year = monthDate.getFullYear();
	const month = monthDate.getMonth();
	const firstDay = new Date(year, month, 1);
	const lastDay = new Date(year, month + 1, 0);
	const monthLabel = monthDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

	const header = document.createElement("div");
	header.className = "calendar-header";
	const previousButton = document.createElement("button");
	previousButton.type = "button";
	previousButton.className = "button-secondary";
	previousButton.dataset.calendarPrevious = "true";
	previousButton.textContent = "‹";
	previousButton.setAttribute("aria-label", "Bulan sebelumnya");
	const title = document.createElement("h2");
	title.textContent = monthLabel;
	const nextButton = document.createElement("button");
	nextButton.type = "button";
	nextButton.className = "button-secondary";
	nextButton.dataset.calendarNext = "true";
	nextButton.textContent = "›";
	nextButton.setAttribute("aria-label", "Bulan berikutnya");
	header.append(previousButton, title, nextButton);
	container.append(header);

	const grid = document.createElement("div");
	grid.className = "calendar-grid";
	grid.setAttribute("role", "grid");
	WEEKDAY_LABELS.forEach((label) => {
		const weekday = document.createElement("span");
		weekday.className = "calendar-weekday";
		weekday.setAttribute("role", "columnheader");
		weekday.textContent = label;
		grid.append(weekday);
	});

	for (let index = 0; index < firstDay.getDay(); index += 1) {
		const spacer = document.createElement("span");
		spacer.className = "calendar-day calendar-day--outside";
		grid.append(spacer);
	}

	for (let day = 1; day <= lastDay.getDate(); day += 1) {
		const date = new Date(year, month, day);
		const dateString = formatLocalDate(date);
		const cell = document.createElement("div");
		cell.className = "calendar-day";
		cell.dataset.calendarDate = dateString;
		cell.setAttribute("role", "gridcell");
		const dayButton = document.createElement("button");
		dayButton.type = "button";
		dayButton.className = "calendar-day__number";
		dayButton.dataset.calendarDate = dateString;
		dayButton.textContent = String(day);
		dayButton.setAttribute("aria-label", `Tambah task pada ${dateString}`);
		cell.append(dayButton);

		tasks.filter((task) => task.dueDate === dateString && !task.archived).forEach((task) => {
			const taskButton = document.createElement("button");
			taskButton.type = "button";
			taskButton.className = `calendar-task${task.completed ? " is-completed" : ""}`;
			taskButton.dataset.calendarTaskId = task.id;
			taskButton.textContent = task.title;
			taskButton.title = task.title;
			cell.append(taskButton);
		});
		grid.append(cell);
	}
	container.append(grid);
}

/**
 * Merender week view dengan grid waktu untuk task time-blocking.
 * @param {HTMLElement} container Container kalender.
 * @param {Array<object>} tasks Task yang tersedia.
 * @param {Date} weekDate Tanggal di minggu yang ditampilkan.
 * @param {(task: object) => void} onTaskClick Callback task.
 */
export function renderWeekCalendar(container, tasks, weekDate, onTaskClick) {
	container.replaceChildren();
	const start = new Date(weekDate);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - start.getDay());
	const header = document.createElement("div");
	header.className = "calendar-week-header";
	for (let day = 0; day < 7; day += 1) {
		const date = new Date(start);
		date.setDate(start.getDate() + day);
		const column = document.createElement("div");
		column.className = "calendar-week-day-label";
		column.textContent = date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
		header.append(column);
	}
	container.append(header);

	const grid = document.createElement("div");
	grid.className = "week-calendar-grid";
	const timeColumn = document.createElement("div");
	timeColumn.className = "week-time-column";
	for (let hour = 6; hour <= 23; hour += 1) {
		const label = document.createElement("span");
		label.textContent = `${String(hour).padStart(2, "0")}:00`;
		timeColumn.append(label);
	}
	grid.append(timeColumn);

	for (let day = 0; day < 7; day += 1) {
		const date = new Date(start);
		date.setDate(start.getDate() + day);
		const dateString = formatLocalDate(date);
		const column = document.createElement("div");
		column.className = "week-day-column";
		for (let hour = 6; hour <= 23; hour += 1) {
			const slot = document.createElement("div");
			slot.className = "week-time-slot";
			slot.dataset.weekDate = dateString;
			slot.dataset.weekTime = `${String(hour).padStart(2, "0")}:00`;
			column.append(slot);
		}
		const dayTasks = tasks.filter((task) => task.dueDate === dateString && !task.archived);
		const timedTasks = dayTasks.filter((task) => task.dueTime && task.durationMin);
		const allDayTasks = dayTasks.filter((task) => !task.dueTime || !task.durationMin);
		allDayTasks.forEach((task) => {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = `calendar-all-day-chip${task.completed ? " is-completed" : ""}`;
			chip.dataset.calendarTaskId = task.id;
			chip.textContent = task.title;
			column.prepend(chip);
		});
		const laneEnds = [];
		timedTasks.sort((first, second) => first.dueTime.localeCompare(second.dueTime)).forEach((task) => {
			const [hours, minutes] = task.dueTime.split(":").map(Number);
			const top = ((hours - 6) * 60 + minutes) / 60 * 56;
			const height = Math.max((task.durationMin / 60) * 56, 28);
			const startMinutes = hours * 60 + minutes;
			let lane = laneEnds.findIndex((end) => end <= startMinutes);
			if (lane === -1) lane = laneEnds.length;
			laneEnds[lane] = startMinutes + task.durationMin;
			const block = document.createElement("button");
			block.type = "button";
			block.className = `calendar-time-block${task.completed ? " is-completed" : ""}`;
			block.dataset.calendarTaskId = task.id;
			block.style.top = `${top}px`;
			block.style.height = `${height}px`;
			block.style.left = `calc(${lane * (100 / Math.max(laneEnds.length, 1))}% + 2px)`;
			block.style.width = `calc(${100 / Math.max(laneEnds.length, 1)}% - 4px)`;
			block.textContent = `${task.dueTime} ${task.title}`;
			block.title = `${task.title} (${task.durationMin} menit)`;
			const resizeHandle = document.createElement("span");
			resizeHandle.className = "calendar-time-block__resize";
			resizeHandle.dataset.resizeTaskId = task.id;
			block.append(resizeHandle);
			column.append(block);
		});
		grid.append(column);
	}
	container.append(grid);
}
