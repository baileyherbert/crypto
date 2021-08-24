<script lang="ts">
	import type { WebChartData } from 'src/engine/models/WebChart';
	import { createEventDispatcher, onMount } from 'svelte';
	import { Backend } from 'src/globals';

	const { chartCurrentTick, chartData }  = Backend.chart;

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

	function getMinorTicks(interval: string, range: number) {
		switch (interval) {
			case 'minute': {
				if (range <= 20) return { unit: 'minute', count: 1 };
				if (range <= 40) return { unit: 'minute', count: 2 };
				if (range <= 100) return { unit: 'minute', count: 5 };
				if (range <= 180) return { unit: 'minute', count: 10 };
				if (range <= 280) return { unit: 'minute', count: 15 };
				if (range <= 600) return { unit: 'minute', count: 30 };
				if (range <= 900) return { unit: 'minute', count: 50 };
				if (range <= 1300) return { unit: 'minute', count: 80 };
				if (range <= 1500) return { unit: 'minute', count: 120 };
				if (range <= 2000) return { unit: 'minute', count: 150 };

				return { unit: 'minute', count: 180 };
			}

			case 'hour': {
				if (range <= 20) return { unit: 'hour', count: 1 };
				if (range <= 40) return { unit: 'hour', count: 2 };
				if (range <= 100) return { unit: 'hour', count: 5 };
				if (range <= 180) return { unit: 'hour', count: 10 };
				if (range <= 280) return { unit: 'hour', count: 15 };
				if (range <= 600) return { unit: 'hour', count: 30 };
				if (range <= 900) return { unit: 'hour', count: 50 };
				if (range <= 1300) return { unit: 'hour', count: 80 };
				if (range <= 1500) return { unit: 'hour', count: 120 };
				if (range <= 2000) return { unit: 'hour', count: 150 };

				return { unit: 'hour', count: 180 };
			}

			case 'day': {
				if (range <= 20) return { unit: 'day', count: 1 };
				if (range <= 40) return { unit: 'day', count: 2 };
				if (range <= 100) return { unit: 'day', count: 5 };
				if (range <= 180) return { unit: 'day', count: 10 };
				if (range <= 280) return { unit: 'day', count: 15 };
				if (range <= 600) return { unit: 'day', count: 30 };
				if (range <= 900) return { unit: 'day', count: 50 };
				if (range <= 1300) return { unit: 'day', count: 80 };
				if (range <= 1500) return { unit: 'day', count: 120 };
				if (range <= 2000) return { unit: 'day', count: 150 };

				return { unit: 'day', count: 180 };
			}
		}

		return { unit: 'minute', count: 15 };
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
			.format((x: any) => '$' + x.value.toLocaleString('en-US', {
				minimumFractionDigits: 0,
				maximumFractionDigits: 3
			}));

		// @ts-ignore
		chart.tooltip().format((e: any) => {
			const close: number = e.close;
			const high: number = e.high;
			const low: number = e.low;
			const open: number = e.open;
			const timestamp: number = e.x;
			const offset = offsetCache.get(timestamp);

			dispatch('tooltip', {
				open,
				high,
				low,
				close,
				timestamp,
				offset
			});
		});

		chart.tooltip().useHtml(true);

		chart.plot(0).yAxis().orientation('right');
		chart.plot(0).yAxis().stroke('#070f15').labels().fontSize(10);
		chart.plot(0).yAxis().ticks().stroke('#2c3338').length(0);
		chart.plot(0).yAxis().labels().padding(10);

		// @ts-ignore
		chart.plot(0).yAxis().labels().format((x: any) => '$' + x.value.toLocaleString('en-US', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 3
		}));

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

		chart.listen('selectedrangechange', (e: any) => {
			const interval: string = e.dataIntervalUnit;
			const firstTimestamp: number = e.firstVisible;
			const lastTimestamp: number = e.lastVisible;
			const isRightEdge = $chartCurrentTick ? ($chartCurrentTick.timestamp === lastTimestamp) : true;

			range = (lastTimestamp - firstTimestamp) / getInterval(interval);
			const ticks = getMinorTicks(interval, range);
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
							dispatch('tooltipExit');
						}
					}
				});
			});
		});

		observer.observe(containerElement, { subtree: true, childList: true });
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
		let viewDensity = 120;
		if (window.outerWidth < 1600) viewDensity = 90;
		if (window.outerWidth < 1200) viewDensity = 60;
		if (window.outerWidth < 900) viewDensity = 30;
		if (window.outerWidth < 500) viewDensity = 15;

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
				const startData = realChartData[Math.max(0, realChartData.length - (range + 2))];
				const endData = realChartData[realChartData.length - 1];

				// Reset the range
				chart.selectRange(startData[0], Date.now());

				// Add data to trigger a scroller event emit
				dataTable.addData([ endData ]);
			}
		}
	}

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
		}

		return () => {
			if (chart !== undefined) {
				console.log('Disposing the chart');

				// Disconnect the observer otherwise it will flip out from the mass node removal
				observer?.disconnect();

				// Delete the chart from memory
				chart.dispose();
			}
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
