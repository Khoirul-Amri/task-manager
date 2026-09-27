const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

/**
 * Filter dan sort task tanpa mengubah array sumber.
 * @param {Array<object>} tasks Task yang akan diproses.
 * @param {{query?: string, status?: string, priority?: string, category?: string, tags?: string[], sort?: string}} options Opsi filter.
 * @returns {Array<object>} Task hasil filter dan sort.
 */
export function filterAndSortTasks(tasks, options = {}) {
	const query = String(options.query ?? "").trim().toLocaleLowerCase();
	const status = options.status ?? "all";
	const priority = options.priority ?? "all";
	const category = options.category ?? "all";
	const tags = Array.isArray(options.tags) ? options.tags : [];
	const sort = options.sort ?? "created-desc";

	const filteredTasks = tasks.filter((task) => {
		const matchesArchive = status === "archived" ? task.archived === true : task.archived !== true;
		const matchesQuery =
			!query ||
			`${task.title} ${task.description}`.toLocaleLowerCase().includes(query);
		const matchesStatus =
			status === "archived" || status === "all" || (status === "completed" ? task.completed : !task.completed);
		const matchesPriority = priority === "all" || task.priority === priority;
		const matchesCategory = category === "all" || task.category === category;
		const matchesTags = tags.length === 0 || tags.every((tag) => task.tags?.includes(tag));
		return matchesArchive && matchesQuery && matchesStatus && matchesPriority && matchesCategory && matchesTags;
	});

	return [...filteredTasks].sort((firstTask, secondTask) => {
		switch (sort) {
			case "order":
				return firstTask.order - secondTask.order;
			case "created-asc":
				return firstTask.createdAt - secondTask.createdAt;
			case "due-asc": {
				const firstDueDate = firstTask.dueDate ? Date.parse(firstTask.dueDate) : Infinity;
				const secondDueDate = secondTask.dueDate ? Date.parse(secondTask.dueDate) : Infinity;
				return firstDueDate - secondDueDate;
			}
			case "priority-desc":
				return (PRIORITY_RANK[secondTask.priority] ?? 0) - (PRIORITY_RANK[firstTask.priority] ?? 0);
			case "title-asc":
				return firstTask.title.localeCompare(secondTask.title, "id");
			case "title-desc":
				return secondTask.title.localeCompare(firstTask.title, "id");
			case "created-desc":
			default:
				return secondTask.createdAt - firstTask.createdAt;
		}
	});
}
