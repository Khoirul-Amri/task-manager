/**
 * Merender timeline sederhana berbasis deadline dan dependency.
 * @param {HTMLElement} container Container timeline.
 * @param {Array<object>} tasks Task yang akan ditampilkan.
 */
export function renderTimeline(container, tasks) {
	container.replaceChildren();
	const datedTasks = tasks.filter((task) => task.dueDate && !task.archived);
	if (datedTasks.length === 0) {
		const emptyMessage = document.createElement("p");
		emptyMessage.textContent = "Belum ada task dengan deadline.";
		container.append(emptyMessage);
		return;
	}

	const dates = datedTasks.map((task) => Date.parse(task.dueDate));
	const minDate = Math.min(...dates);
	const maxDate = Math.max(...dates, minDate + 86_400_000);
	const span = Math.max(maxDate - minDate, 86_400_000);
	const chart = document.createElement("div");
	chart.className = "timeline-chart";
	const positions = new Map();

	datedTasks.forEach((task) => {
		const row = document.createElement("div");
		row.className = "timeline-row";
		row.dataset.taskId = task.id;
		const label = document.createElement("span");
		label.className = "timeline-label";
		label.textContent = task.title;
		const track = document.createElement("div");
		track.className = "timeline-track";
		const bar = document.createElement("span");
		bar.className = `timeline-bar${task.completed ? " is-completed" : ""}`;
		const position = ((Date.parse(task.dueDate) - minDate) / span) * 100;
		bar.style.left = `${position}%`;
		bar.title = `${task.title} - ${task.dueDate}`;
		track.append(bar);
		row.append(label, track);
		chart.append(row);
		positions.set(task.id, position);
	});

	const dependencies = datedTasks.flatMap((task) =>
		(task.dependsOn ?? [])
			.filter((dependencyId) => positions.has(dependencyId))
			.map((dependencyId) => `${task.title} bergantung pada ${tasks.find((item) => item.id === dependencyId)?.title ?? dependencyId}`),
	);
	if (dependencies.length > 0) {
		const dependencyNote = document.createElement("p");
		dependencyNote.className = "timeline-dependencies";
		dependencyNote.textContent = `Dependency: ${dependencies.join("; ")}`;
		container.append(dependencyNote);
	}
	container.append(chart);
}
