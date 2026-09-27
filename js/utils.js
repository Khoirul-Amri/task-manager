/**
 * Menunda pemanggilan fungsi sampai input berhenti berubah.
 * @param {Function} callback Fungsi yang akan dipanggil.
 * @param {number} delay Waktu tunggu dalam milidetik.
 * @returns {Function} Fungsi yang sudah di-debounce.
 */
export function debounce(callback, delay = 300) {
	let timeoutId;

	return (...args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => callback(...args), delay);
	};
}
