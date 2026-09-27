const PRIORITY_LABELS = {
	low: "Rendah",
	medium: "Sedang",
	high: "Tinggi",
};

/**
 * Mengklasifikasikan deadline terhadap waktu hari ini.
 * @param {string|null} dueDate Tanggal ISO tanpa waktu.
 * @returns {string} Kelas status deadline.
 */
function getDueDateStatus(dueDate) {
	if (!dueDate) {
		return "";
	}

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const deadline = new Date(`${dueDate}T00:00:00`);
	const daysUntilDue = Math.ceil((deadline - today) / 86_400_000);

	if (daysUntilDue < 0) {
		return "is-overdue";
	}
	if (daysUntilDue <= 1) {
		return "is-due-soon";
	}
	return "";
}

/**
 * Menghitung seluruh subtugas dalam tree.
 * @param {Array<object>} subtasks Tree subtugas.
 * @returns {{total: number, completed: number}} Ringkasan progress.
 */
function getSubtaskProgress(subtasks) {
	return (subtasks ?? []).reduce(
		(progress, subtask) => {
			progress.total += 1;
			progress.completed += subtask.completed ? 1 : 0;
			const nestedProgress = getSubtaskProgress(subtask.subtasks);
			progress.total += nestedProgress.total;
			progress.completed += nestedProgress.completed;
			return progress;
		},
		{ total: 0, completed: 0 },
	);
}

/**
 * Merender satu level tree subtugas dan form child-subtask.
 * @param {Array<object>} subtasks Subtasks pada level ini.
 * @param {object} task Task induk.
 * @param {number} depth Kedalaman saat ini.
 * @returns {HTMLElement} List subtugas.
 */
function renderSubtaskTree(subtasks, task, depth = 0) {
	const list = document.createElement("ul");
	list.className = "subtask-list";
	list.dataset.depth = String(depth);

	(subtasks ?? []).forEach((subtask) => {
		const item = document.createElement("li");
		item.className = "subtask-item";
		const row = document.createElement("div");
		row.className = "subtask-row";
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = subtask.completed;
		checkbox.disabled = task.id === "demo-task";
		checkbox.dataset.subtaskId = subtask.id;
		const title = document.createElement("span");
		title.textContent = subtask.title;
		if (subtask.completed) title.classList.add("is-completed");
		row.append(checkbox, title);
		item.append(row);

		if (depth < 4) {
			const childForm = document.createElement("form");
			childForm.className = "subtask-form subtask-form--nested";
			childForm.dataset.parentSubtaskId = subtask.id;
			const input = document.createElement("input");
			input.type = "text";
			input.placeholder = "Tambah subtugas turunan";
			input.maxLength = 100;
			input.dataset.subtaskInput = "true";
			input.disabled = task.id === "demo-task";
			const button = document.createElement("button");
			button.type = "submit";
			button.className = "button-secondary";
			button.textContent = "+";
			button.setAttribute("aria-label", `Tambah subtugas ke ${subtask.title}`);
			button.disabled = task.id === "demo-task";
			childForm.append(input, button);
			item.append(childForm);
		}

		if (subtask.subtasks?.length) {
			item.append(renderSubtaskTree(subtask.subtasks, task, depth + 1));
		}
		list.append(item);
	});
	return list;
}

/**
 * Membuat elemen kartu dari data task tanpa menyisipkan HTML dari pengguna.
 * @param {object} task Data task yang akan ditampilkan.
 * @returns {HTMLElement} Elemen artikel kartu task.
 */
export function renderTaskCard(task) {
	const card = document.createElement("article");
	card.className = "task-card";
	card.dataset.taskId = task.id;
	card.draggable = task.id !== "demo-task";

	const header = document.createElement("div");
	header.className = "task-card__header";

	const titleWrapper = document.createElement("div");
	titleWrapper.className = "task-card__title-wrapper";

	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.checked = task.completed;
	checkbox.disabled = task.id === "demo-task";
	checkbox.setAttribute("aria-label", `Tandai ${task.title} selesai`);

	const title = document.createElement("h3");
	title.className = "task-card__title";
	title.textContent = task.title;
	if (task.completed) {
		title.classList.add("is-completed");
	}

	titleWrapper.append(checkbox, title);

	const priority = document.createElement("span");
	priority.className = `priority-badge priority-badge--${task.priority}`;
	priority.textContent = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium;

	header.append(titleWrapper, priority);
	if (task.recurrence) {
		const recurring = document.createElement("span");
		recurring.className = "recurring-badge";
		recurring.setAttribute("aria-label", "Task berulang");
		recurring.textContent = "↻ Berulang";
		header.append(recurring);
	}
	card.append(header);

	if (task.description) {
		const description = document.createElement("p");
		description.className = "task-card__description";
		description.textContent = task.description;
		card.append(description);
	}

	const metadata = document.createElement("div");
	metadata.className = "task-card__metadata";

	if (task.category) {
		const category = document.createElement("span");
		category.className = "task-card__category";
		category.textContent = task.category;
		metadata.append(category);
	}

	(task.tags ?? []).forEach((tag) => {
		const tagBadge = document.createElement("span");
		tagBadge.className = "task-card__tag";
		tagBadge.textContent = `#${tag}`;
		metadata.append(tagBadge);
	});

	if (task.dueDate) {
		const deadline = document.createElement("time");
		deadline.className = `task-card__deadline ${getDueDateStatus(task.dueDate)}`;
		deadline.dateTime = task.dueDate;
		deadline.textContent = `Deadline: ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("id-ID")}`;
		metadata.append(deadline);
	}

	if (task.dependsOn?.length) {
		const dependencyNote = document.createElement("span");
		dependencyNote.className = "task-card__dependency";
		dependencyNote.textContent = `Dependency: ${task.dependsOn.length}`;
		metadata.append(dependencyNote);
	}

	const subtaskCount = Array.isArray(task.subtasks) ? task.subtasks.length : 0;
	if (subtaskCount > 0) {
		const subtasks = document.createElement("span");
		subtasks.textContent = `${subtaskCount} subtugas`;
		metadata.append(subtasks);
	}

	if (metadata.childElementCount > 0) {
		card.append(metadata);
	}

	const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
	const subtaskProgress = getSubtaskProgress(subtasks);
	const progress = document.createElement("div");
	progress.className = "subtask-progress";
	const progressLabel = document.createElement("span");
	progressLabel.textContent = `Subtugas: ${subtaskProgress.completed}/${subtaskProgress.total}`;
	const progressBar = document.createElement("progress");
	progressBar.value = subtaskProgress.completed;
	progressBar.max = Math.max(subtaskProgress.total, 1);
	progressBar.setAttribute("aria-label", `Progress subtugas ${task.title}`);
	progress.append(progressLabel, progressBar);
	card.append(progress);

	if (subtasks.length > 0) {
		card.append(renderSubtaskTree(subtasks, task));
	}

	const subtaskForm = document.createElement("form");
	subtaskForm.className = "subtask-form";
	const subtaskInput = document.createElement("input");
	subtaskInput.type = "text";
	subtaskInput.placeholder = "Tambah subtugas";
	subtaskInput.maxLength = 100;
	subtaskInput.dataset.subtaskInput = "true";
	subtaskInput.disabled = task.id === "demo-task";
	const subtaskButton = document.createElement("button");
	subtaskButton.type = "submit";
	subtaskButton.className = "button-secondary";
	subtaskButton.textContent = "Tambah";
	subtaskButton.disabled = task.id === "demo-task";
	subtaskForm.append(subtaskInput, subtaskButton);
	card.append(subtaskForm);

	const actions = document.createElement("div");
	actions.className = "task-card__actions";
	[
		["edit", "Edit"],
		["delete", "Hapus"],
		[task.archived ? "unarchive" : "archive", task.archived ? "Pulihkan" : "Arsipkan"],
	].forEach(([action, label]) => {
		const actionButton = document.createElement("button");
		actionButton.type = "button";
		actionButton.className = "button-secondary";
		actionButton.dataset.action = action;
		actionButton.textContent = label;
		actionButton.disabled = task.id === "demo-task";
		actions.append(actionButton);
	});
	card.append(actions);

	return card;
}

/**
 * Menggambar ulang daftar task pada container yang tersedia.
 * @param {HTMLElement} container Elemen daftar task.
 * @param {Array<object>} tasks Task yang akan ditampilkan.
 */
export function renderTaskList(container, tasks, emptyMessage = "Belum ada tugas.") {
	container.replaceChildren();

	if (tasks.length === 0) {
		const emptyState = document.createElement("div");
		emptyState.className = "empty-state";
		const emptyIcon = document.createElement("span");
		emptyIcon.className = "empty-state__icon";
		emptyIcon.setAttribute("aria-hidden", "true");
		emptyIcon.textContent = "□";
		const emptyText = document.createElement("p");
		emptyText.textContent = emptyMessage;
		emptyState.append(emptyIcon, emptyText);
		container.append(emptyState);
		return;
	}

	const fragment = document.createDocumentFragment();
	tasks.forEach((task) => fragment.append(renderTaskCard(task)));
	container.append(fragment);
}
