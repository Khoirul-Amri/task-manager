import { renderTaskCard } from "../ui.js";

const QUADRANTS = [
	{ key: "urgent-important", title: "Urgent + Important" },
	{ key: "not-urgent-important", title: "Important saja" },
	{ key: "urgent-not-important", title: "Urgent saja" },
	{ key: "not-urgent-not-important", title: "Tidak keduanya" },
];

/**
 * Menentukan apakah task mendesak berdasarkan deadline lokal.
 * @param {object} task Task yang dinilai.
 * @returns {boolean} True jika deadline maksimal besok.
 */
function isUrgent(task) {
	if (!task.dueDate) return false;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const dueDate = new Date(`${task.dueDate}T00:00:00`);
	return Math.ceil((dueDate - today) / 86_400_000) <= 1;
}

/**
 * Mendapatkan kuadran Eisenhower sebuah task.
 * @param {object} task Task yang dinilai.
 * @returns {string} Key kuadran.
 */
export function getTaskQuadrant(task) {
	const urgent = isUrgent(task);
	const important = task.priority === "high" || task.priority === "medium";
	return `${urgent ? "urgent" : "not-urgent"}-${important ? "important" : "not-important"}`;
}

/**
 * Merender matrix task dalam empat kuadran.
 * @param {HTMLElement} container Container matrix.
 * @param {Array<object>} tasks Task yang ditampilkan.
 */
export function renderMatrix(container, tasks) {
	container.replaceChildren();
	QUADRANTS.forEach((quadrant) => {
		const section = document.createElement("section");
		section.className = "matrix-quadrant";
		section.dataset.matrixQuadrant = quadrant.key;
		section.setAttribute("aria-labelledby", `matrix-${quadrant.key}`);
		const heading = document.createElement("h3");
		heading.id = `matrix-${quadrant.key}`;
		heading.textContent = quadrant.title;
		const dropzone = document.createElement("div");
		dropzone.className = "matrix-quadrant__dropzone";
		dropzone.dataset.matrixDropzone = quadrant.key;
		tasks.filter((task) => !task.archived && getTaskQuadrant(task) === quadrant.key).forEach((task) => {
			const card = renderTaskCard(task);
			card.classList.add("matrix-card");
			dropzone.append(card);
		});
		if (!dropzone.childElementCount) {
			const empty = document.createElement("p");
			empty.textContent = "Belum ada task.";
			dropzone.append(empty);
		}
		section.append(heading, dropzone);
		container.append(section);
	});
}
