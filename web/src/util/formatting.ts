/**
 * Formats the given number with the specified number of decimal places. Rounds the number as needed and adds commas
 * for thousands, millions, etc.
 *
 * @param number
 * @param length
 * @returns
 */
export function formatDecimal(number: number, length: number) {
	return number.toLocaleString('en-US', {
		useGrouping: true,
		minimumFractionDigits: length,
		maximumFractionDigits: length
	});
}

/**
 * Formats the given percent for display as a trend.
 *
 * @param percent
 * @returns
 */
export function formatTrendPercent(percent?: number) {
	if (typeof percent !== 'number') {
		return '0.00';
	}

	if (percent < 0) percent *= -1;
	return formatDecimal(percent, 2);
}
