import { renderTaskCard } from "../ui.js";

/**
 * Merender task ke board Kanban berbasis status.
 * @param {HTMLElement} container Container board.
 * @param {Array<object>} tasks Task yang terlihat.
 */
export function renderBoard(container, tasks) {
	container.replaceChildren();
	const columns = [
		{ key: "active", label: "Aktif", completed: false },
		{ key: "completed", label: "Selesai", completed: true },
	];

	columns.forEach((column) => {
		const section = document.createElement("section");
		section.className = "board-column";
		section.dataset.status = column.key;
		section.setAttribute("aria-labelledby", `board-${column.key}-heading`);
		const heading = document.createElement("div");
		heading.className = "board-column__heading";
		const title = document.createElement("h3");
		title.id = `board-${column.key}-heading`;
		title.textContent = column.label;
		const count = document.createElement("span");
		count.textContent = String(tasks.filter((task) => task.completed === column.completed).length);
		heading.append(title, count);
		const dropZone = document.createElement("div");
		dropZone.className = "board-column__dropzone";
		dropZone.dataset.boardStatus = column.key;
		const columnTasks = tasks.filter((task) => task.completed === column.completed);
		if (columnTasks.length === 0) {
			const empty = document.createElement("p");
			empty.className = "board-column__empty";
			empty.textContent = "Belum ada task.";
			dropZone.append(empty);
		} else {
			columnTasks.forEach((task) => {
				const card = renderTaskCard(task);
				card.classList.add("board-card");
				dropZone.append(card);
			});
		}
		section.append(heading, dropZone);
		container.append(section);
	});
}
