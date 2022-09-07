<script lang="ts">
	import type { WebChartCorrection, WebChartData } from 'src/engine/models/WebChart';
	import { createEventDispatcher, onMount } from 'svelte';
	import { Backend } from 'src/globals';

	const { chartCurrentTick, chartData, interval }  = Backend.chart;

	export let enableEma12 = false;
	export let enableEma26 = false;

	// Storage for the actual chart data
	let realChartData: Array<number[]> = [];
	let offsetCache = new Map<number, number>();

	// Loader state
	let loading = true;

	// Chart related variables
	let containerElement: HTMLDivElement;
	let dataTable: anychart.data.Table;
	let mapping: anychart.data.TableMapping;
	let chart: anychart.charts.Stock;
	let series: anychart.core.stock.series.Candlestick;
	let observer: MutationObserver;
	let ema12: anychart.core.stock.series.Base | anychart.core.stock.scrollerSeries.Base;
	let ema26: anychart.core.stock.series.Base | anychart.core.stock.scrollerSeries.Base;
	let range: number;

	// Tracking the hovered or selected item
	let isMouseDown = false;
	let mouseDownAt = 0;
	let mouseDownCoords = { x: 0, y: 0 };
	export let hovering = false;
	export let hoveringData: WebChartData | undefined = undefined;
	export let selected = false;
	export let selectedData: WebChartData | undefined = undefined;

	export const deselect = () => {
		if (selected) {
			chart?.annotations().removeAllAnnotations();
			selected = false;
			selectedData = undefined;
		}
	};

	// Calculate the current timezone for localization
	var offset = new Date().getTimezoneOffset();
	var zone = new Date().toLocaleTimeString('en-us', {
		timeZoneName: 'short'
	}).split(' ')[2];

	// Apply the default output timezone
	anychart.format.outputTimezone(offset);

	// Dispatcher for outgoing events
	// Svelte seems to automatically detect the events and their types?
	const dispatch = createEventDispatcher();

	/**
	 * Converts web chart data into an array for graph input.
	 * @param dto
	 */
	function getChartData(dto: WebChartData) {
		return [
			dto.timestamp,
			dto.data.close,
			dto.data.open,
			dto.data.high,
			dto.data.low
		];
	}

	function getInterval(interval: string) {
		switch (interval) {
			case 'second': return 1000;
			case 'minute': return 60000;
			case 'hour': return 60000 * 60;
			case 'day': return 60000 * 60 * 24;
		}
	}

	function getChartIntervalMillis() {
		switch (interval.get()) {
			case '1m': return 60000;
			case '5m': return 60000 * 5;
			case '15m': return 60000 * 15;
			case '1h': return 3600000;
			case '6h': return 3600000 * 6;
			case '1d': return 86400000;
		}
	}

	function getTickMultiplier() {
		switch (interval.get()) {
			case '1m': return { minute: 1, hour: 1, day: 1 };
			case '5m': return { minute: 5, hour: 1, day: 1 };
			case '15m': return { minute: 15, hour: 1, day: 1 };
			case '1h': return { minute: 60, hour: 1, day: 1 };
			case '6h': return { minute: 360, hour: 6, day: 1 };
			case '1d': return { minute: 1440, hour: 24, day: 1 };
		}
	}

	function getDurationCalc(count: number) {
		switch (interval.get()) {
			case '1m': return { unit: 'minute', count: count * 1 };
			case '5m': return { unit: 'minute', count: count * 5 };
			case '15m': return { unit: 'minute', count: count * 15 };
			case '1h': return { unit: 'hour', count: count * 1 };
			case '6h': return { unit: 'hour', count: count * 6 };
			case '1d': return { unit: 'day', count: count * 1 };
		}
	}

	function getTickCount() {
		return Math.floor(window.outerWidth / 130);
	}

	function getMinorTicks(range: number) {
		const duration = getChartIntervalMillis();
		const targetTicks = getTickCount();
		const totalWidth = range * duration;
		const tickMillis = totalWidth / targetTicks;

		const count = Math.round(tickMillis / duration);
		const result = getDurationCalc(count);

		return result;
	}

	function getCurrentMinorTicks(): { unit: string, count: number } {
		// @ts-ignore
		return chart.xScale().ticks()[0].minor;
	}

	/**
	 * Creates the base chart with all settings applied but no data.
	 */
	function createInitialChart() {
		chart = anychart.stock();
        chart.container(containerElement);
		chart.background().fill('#070f15');
		chart.scroller().enabled(false);

		// Crosshairs
		chart.crosshair()
			.displayMode('sticky')
			.xStroke({ dash: '2 2', color: '#52575c' })
			.yStroke({ dash: '2 2', color: '#52575c' })

		chart.crosshair()
			.xLabel().fontSize(10).padding(18, 0, 0, 10).background('transparent')
			// @ts-ignore
			.format((e: any) => {
				return anychart.format.dateTime(e.rawValue, 'M/d/y, k:mm', offset) + ' ' + zone;
			});

		chart.crosshair()
			.yLabel().fontSize(10).padding(0, 0, 0, 12).background('#070f15')
			// @ts-ignore
			.format((x: any) => {
				if (typeof x.value !== 'number') {
					return '';
				}

				return '$' + x.value.toLocaleString('en-US', {
					minimumFractionDigits: 0,
					maximumFractionDigits: 3
				});
			});

		// @ts-ignore
		chart.tooltip().format((e: any) => {
			const close: number = e.close;
			const high: number = e.high;
			const low: number = e.low;
			const open: number = e.open;
			const timestamp: number = e.x;
			const offset = offsetCache.get(timestamp);

			hovering = true;
			hoveringData = {
				timestamp,
				offset,
				data: {
					open,
					high,
					low,
					close,
				}
			};

			if (open !== undefined) {
				dispatch('tooltip', {
					open,
					high,
					low,
					close,
					timestamp,
					offset
				});
			}
		});

		chart.tooltip().useHtml(true);

		chart.plot(0).yAxis().orientation('right');
		chart.plot(0).yAxis().stroke('#070f15').labels().fontSize(10);
		chart.plot(0).yAxis().ticks().stroke('#2c3338').length(0);
		chart.plot(0).yAxis().labels().padding(10);

		// @ts-ignore
		chart.plot(0).yAxis().labels().format((x: any) => {
			if (typeof x.value !== 'number') {
				return '';
			}

			return '$' + x.value.toLocaleString('en-US', {
				minimumFractionDigits: 0,
				maximumFractionDigits: 3
			});
		});

		chart.plot(0).xAxis().labels().fontSize(10);
		chart.plot(0).xAxis().minorLabels().fontSize(10);
		chart.plot(0).xAxis().background('#070f15');

		chart.plot(0).legend(false);

		chart.padding(-1, 85, 15, -1);

		chart.plot(0).xGrid().enabled(true).stroke('#2c3338');
		chart.plot(0).yGrid().enabled(true).stroke('#2c3338');
		chart.plot(0).xMinorGrid().enabled(true).stroke('#2c3338');
		chart.plot(0).xAxis().showHelperLabel(false);

		// @ts-ignore
		chart.xScale().ticks([{
			minor: { unit: 'minute', count: 15 },
			major: 'year'
		}]);

		chart.plot(0).yScale()
			.alignMinimum(false)
			.alignMaximum(false)
			.maxTicksCount(7);

		// chart.plot(0).maxPointWidth(15);

		chart.listen("mouseOver", function(e){
			document.body.style.cursor = "crosshair";
		});

		chart.listen("mouseOut", function(e){
			document.body.style.cursor = "auto";
		});

		// chart.plot(0).

		// series.pointWidth(3);

		let indicator = chart.plot(0).priceIndicator();
		indicator.value('series-end');
		indicator.stroke('transparent');
		indicator.label().background('#070f15').fontSize(10).padding(0, 0, 0, 10);

		// @ts-ignore
		indicator.label().format((ctx: any) => {
			const price: number = ctx.value;
			const open: number = ctx.open;

			if (typeof price !== 'number') {
				return '';
			}

			if (price >= open) {
				indicator.label().fontColor('#3eb444');
			}
			else {
				indicator.label().fontColor('#f9672d');
			}

			return '$' + price.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 3
			});
		});

		chart.listen('mousedown', (e: any) => {
			isMouseDown = true;
			mouseDownAt = Date.now();
			mouseDownCoords = {
				x: e.screenX,
				y: e.screenY
			};
		});

		chart.listen('mouseup', (e: any) => {
			if (window.outerWidth < 1200 || !isMouseDown) {
				isMouseDown = false;
				return;
			}

			isMouseDown = false;

			if (hovering && hoveringData && hoveringData.offset) {
				if (selectedData?.offset === hoveringData.offset) {
					selected = false;
					selectedData = undefined;

					chart.annotations().removeAllAnnotations();
				}
				else if (chartCurrentTick.get() === undefined || hoveringData.offset < chartCurrentTick.get().offset) {
					if (mouseDownAt <= Date.now() - 1000) {
						if (Math.abs(e.screenX - mouseDownCoords.x) < 5) {
							if (Math.abs(e.screenY - mouseDownCoords.y) < 5) {
								selected = true;
								selectedData = hoveringData;

								chart.annotations().removeAllAnnotations();
								chart.plot(0).annotations().verticalLine({
									xAnchor: selectedData.timestamp,
									normal: { stroke: '2 #00AEFF60' }
								})
									.allowEdit(false)
									.markers(false);
							}
						}
					}
				}
			}
		});

		chart.listen('selectedrangechange', (e: any) => {
			const interval: string = e.dataIntervalUnit;
			const firstTimestamp: number = e.firstVisible;
			const lastTimestamp: number = e.lastVisible;
			const isRightEdge = $chartCurrentTick ? ($chartCurrentTick.timestamp === lastTimestamp) : true;

			range = (lastTimestamp - firstTimestamp) / getChartIntervalMillis() + 1;
			const ticks = getMinorTicks(range);
			const currentTicks = getCurrentMinorTicks();

			// Decrease frequency of ticks for smaller screens
			if (window.outerWidth <= 892) ticks.count *= 2;
			if (window.outerWidth <= 500) ticks.count *= 2;

			// Update the ticks if needed
			if (currentTicks.count !== ticks.count || currentTicks.unit !== ticks.unit) {
				// @ts-ignore
				chart.xScale().ticks([{minor: ticks, major: 'day'}]);
			}

			// Emit an event for scroll
			dispatch('scrolled', !isRightEdge);

			if (e.source === 'plot-drag') {
				isMouseDown = false;
			}

			// Update range in storage
			if (!isNaN(range) && range > 0) {
				localStorage.setItem('chart-range', range.toString());
			}
		});

		chart.interactivity().zoomOnMouseWheel(true);
        chart.draw();
		chart.enabled(false);
		loading = true;

		observer = new MutationObserver(function(mutations_list) {
			mutations_list.forEach(function(mutation) {
				mutation.removedNodes.forEach(function(removed_node) {
					if (removed_node && removed_node.nodeType === Node.ELEMENT_NODE) {
						const el = <HTMLElement>removed_node;

						if (el.classList.contains('anychart-tooltip')) {
							hovering = false;
							hoveringData = undefined;
							dispatch('tooltipExit');
						}
					}
				});
			});
		});

		observer.observe(containerElement, { subtree: true, childList: true });
	}

	function getViewDensity() {
		const data = localStorage.getItem('chart-range');

		if (typeof data !== 'string') {
			let viewDensity = 120;

			if (window.outerWidth < 1600) viewDensity = 90;
			if (window.outerWidth < 1200) viewDensity = 60;
			if (window.outerWidth < 900) viewDensity = 30;
			if (window.outerWidth < 500) viewDensity = 15;

			return viewDensity;
		}

		const int = +data;

		if (isNaN(int) || int <= 0) {
			return 120;
		}

		return int;
	}

	/**
	 * Clears the chart and sets new data.
	 */
	function setChartData() {
		if (!chart) return;

		// Convert the input data into the format required for the chart
		const mappedData = $chartData.map(d => getChartData(d));
		realChartData = mappedData;
		offsetCache.clear();

		// Cache the offsets for debugging
		for (const data of $chartData) {
			offsetCache.set(data.timestamp, data.offset);
		}

		// Calculate the starting data density for chart data based on device width
		let viewDensity = getViewDensity();

		// Grab the start data
		const startData = mappedData[Math.max(0, mappedData.length - viewDensity)];
		const endData = mappedData[mappedData.length - 1];

		// Create the datatable
		dataTable = anychart.data.table(0);
        dataTable.addData(mappedData);

		// Create the datatable mapping for candlestick view
		mapping = dataTable.mapAs({ 'open': 2, 'high': 3, 'low': 4, 'close': 1 });

		// Replace existing data
		if (chart.plot(0).getSeriesCount() > 0) {
			console.log('Replacing data in existing series');
			series.data(mapping);

			// Delete the existing EMA instances
			chart.plot(0).removeSeriesAt(2);
			chart.plot(0).removeSeriesAt(1);

			// Create new EMA instances
			ema12 = chart.plot(0).sma(mapping, 12).series();
			// @ts-ignore
			ema12.stroke('#a9f9f9');
			ema12.enabled(enableEma12);

			ema26 = chart.plot(0).sma(mapping, 26).series();
			// @ts-ignore
			ema26.stroke('#d1d1d1');
			ema26.enabled(enableEma12);

			// Enable the chart
			chart.enabled(true);
			loading = false;

			// Set the starting range on the chart
			// TODO: Remember user preference
			chart.selectRange(startData[0], Date.now());
			dataTable.addData([ endData ]);

			return;
		}

		console.log('Drawing the chart');

		// Create the series
        series = chart.plot(0).candlestick(mapping);
        series.name("USD");

		// Set series colors
		series.risingFill("#070f15");
		series.risingStroke("#3eb444");
		series.fallingFill('#f9672d');
		series.fallingStroke('#f9672d');

		// Set the starting range on the chart
		// TODO: Remember user preference
		chart.selectRange(startData[0], Date.now());

		// Create the EMA overlays
		ema12 = chart.plot(0).sma(mapping, 12).series();
		// @ts-ignore
		ema12.stroke('#a9f9f9');
		ema12.enabled(enableEma12);

		ema26 = chart.plot(0).sma(mapping, 26).series();
		// @ts-ignore
		ema26.stroke('#d1d1d1');
		ema26.enabled(enableEma12);

		// Enable the chart
		chart.enabled(true);
		loading = false;
	}

	function hideChart() {
		chart?.enabled(false);
		loading = true;
	}

	/**
	 * Resets the current scroll view to the right edge.
	 */
	export const resetScrollView = () => {
		if (chart && chart.enabled()) {
			if (range && !isNaN(range)) {
				const startData = realChartData[Math.max(0, realChartData.length - (range + 1))];
				const endData = realChartData[realChartData.length - 1];

				// Reset the range
				chart.selectRange(startData[0], Date.now());

				// Add data to trigger a scroller event emit
				dataTable.addData([ endData ]);
			}
		}
	}

	const chartCorrector = (dto: WebChartCorrection) => {
		if (!dataTable) return;

		const data = getChartData(dto);

		// Update the graph
		dataTable.addData([
			data
		]);

		// Update the real chart data
		for (let i = 0; i < realChartData.length; i++) {
			const o = realChartData[i];

			if (o[0] === data[0]) {
				realChartData[i] = data;
			}
		}
	};

	// Create the chart on mount
	onMount(() => {
		// Create the chart
		if (chart === undefined) {
			console.log('Creating the chart');
			createInitialChart();

			// Set the chart data if available
			// This will probably never happen but worth catching
			if ($chartData.length > 0) {
				setChartData();
			}

			else {
				console.log('Deferring chart rendering due to lack of data');
			}

			Backend.chart.on('chartCorrection', chartCorrector);
		}

		return () => {
			if (chart !== undefined) {
				console.log('Disposing the chart');

				// Disconnect the observer otherwise it will flip out from the mass node removal
				observer?.disconnect();

				// Delete the chart from memory
				chart.dispose();
			}

			Backend.chart.removeListener('chartCorrection', chartCorrector);
		};
	});

	let previousCurrentTickOffset = 0;

	function updateCurrentTick() {
		if (!dataTable) return;

		// Detect when a new data point is added
		if (previousCurrentTickOffset !== $chartCurrentTick.offset) {
			// Remove the first data point to keep chart width identical
			if (previousCurrentTickOffset > 0) {
				dataTable.removeFirst();
			}

			// Add the new data for scroller reset
			realChartData.push(getChartData($chartCurrentTick));

			// Record the new offset
			previousCurrentTickOffset = $chartCurrentTick.offset;
			offsetCache.set($chartCurrentTick.timestamp, $chartCurrentTick.offset);
		}

		// Add the new data
		dataTable.addData([
			getChartData($chartCurrentTick)
		]);
	}

	// Set chart data when it changes or becomes available
	// This will create a whole new series and is very slow so should be invoked rarely
	$: {
		if ($chartData.length > 0) {
			setChartData();
		}
		else {
			hideChart();
		}
	}

	// Update the current tick as new data comes in
	$: {
		if ($chartCurrentTick) {
			updateCurrentTick();
		}
	}

	// Activate EMA
	$: {
		if (ema12 && ema26) {
			ema12.enabled(enableEma12);
			ema26.enabled(enableEma26);
		}
	}
</script>

<div class="chart-container" bind:this={containerElement}></div>

{#if loading}
	<div class="loading">
		<div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div>
	</div>
{/if}
