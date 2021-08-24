<script lang="ts">
	import type { Interval } from 'src/engine/managers/ChartManager';
	import type { WebAsset } from 'src/engine/models/WebAsset';

	import { Backend } from 'src/globals';
	import Chart from './Chart.svelte';

	const { chartCurrentTick, chartData, interval, type } = Backend.chart;

	export let selectedAsset: WebAsset = undefined;

	let openMetric = '0.000';
	let closeMetric = '0.000';
	let highMetric = '0.000';
	let lowMetric = '0.000';
	let offset = 'N/A';
	let isTooltipActive = false;
	let isScrolledAway = false;

	let enableEma12 = false;
	let enableEma26 = false;

	let resetScrollView: () => void;

	function changeInterval(to: Interval) {
		Backend.chart.setInterval(to);
	}

	function updateTooltip(e: CustomEvent<Tooltip>) {
		const data = e.detail;

		if (data && typeof data.close === 'number') {
			isTooltipActive = true;
			openMetric = data.open.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			closeMetric = data.close.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			highMetric = data.high.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			lowMetric = data.low.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			offset = data.offset.toString();
		}
		else {
			openMetric = '0.000';
			closeMetric = '0.000';
			highMetric = '0.000';
			lowMetric = '0.000';
			offset = 'N/A';
		}
	}

	function stopTooltip(e: CustomEvent<any>) {
		isTooltipActive = false;
	}

	function updateScrollState(e: CustomEvent<boolean>) {
		isScrolledAway = e.detail;
	}

	interface Tooltip {
		open: number;
		high: number;
		low: number;
		close: number;
		timestamp: number;
		offset: number;
	}

	function toggleEma12() {
		enableEma12 = !enableEma12;
	}

	function toggleEma26() {
		enableEma26 = !enableEma26;
	}

	$: {
		const current = $chartCurrentTick;
		if (current && !isTooltipActive) {
			openMetric = current.data.open.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			closeMetric = current.data.close.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			highMetric = current.data.high.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			lowMetric = current.data.low.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			offset = current.offset.toString();
		}
	}

	$: {
		if (!$chartCurrentTick && $chartData.length > 0) {
			const { data, offset: o } = $chartData[$chartData.length - 1];
			openMetric = data.open.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			closeMetric = data.close.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			highMetric = data.high.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			lowMetric = data.low.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
			offset = o.toString();
		}
	};
</script>

<div class="chart-layout">
	<div class="toolbar">
		<div class="dropdown-button">
			<div class="current">
				<div class="value"><button>{ $interval }</button></div>
				<div class="arrow">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
						<path d="M26.91425,13.12115,16.70709,23.32849a.99988.99988,0,0,1-1.41418,0L5.08575,13.12115a.50007.50007,0,0,1,0-.70715l2.8285-2.82806a.5.5,0,0,1,.70709,0L16,16.96436l7.37866-7.37842a.5.5,0,0,1,.70709,0l2.8285,2.82806A.50007.50007,0,0,1,26.91425,13.12115Z"/>
					</svg>
				</div>
			</div>
			<div class="dropdown">
				<ul>
					<li><button on:click={ () => changeInterval('1m') }>1m</button></li>
					<li><button on:click={ () => changeInterval('5m') }>5m</button></li>
					<li><button on:click={ () => changeInterval('15m') }>15m</button></li>
					<li><button on:click={ () => changeInterval('1h') }>1h</button></li>
					<li><button on:click={ () => changeInterval('6h') }>6h</button></li>
					<li><button on:click={ () => changeInterval('1d') }>1d</button></li>
				</ul>
			</div>
		</div>
		<div class="dropdown-button">
			<div class="current">
				<div class="value"><button>Overlay</button></div>
				<div class="arrow">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
						<path d="M26.91425,13.12115,16.70709,23.32849a.99988.99988,0,0,1-1.41418,0L5.08575,13.12115a.50007.50007,0,0,1,0-.70715l2.8285-2.82806a.5.5,0,0,1,.70709,0L16,16.96436l7.37866-7.37842a.5.5,0,0,1,.70709,0l2.8285,2.82806A.50007.50007,0,0,1,26.91425,13.12115Z"/>
					</svg>
				</div>
			</div>
			<div class="dropdown">
				<ul>
					<li><button on:click={ () => toggleEma12() }>
						<div class="indicator ema-12" class:enabled={enableEma12}></div>
						EMA12
					</button></li>
					<li><button on:click={ () => toggleEma26() }>
						<div class="indicator ema-26" class:enabled={enableEma26}></div>
						EMA26
					</button></li>
				</ul>
			</div>
		</div>

		{#if selectedAsset}
			<div class="type-button active" title="The chart will show the balance of this asset that the current account holds." class:active={ $type === 'balance' }>
				<button on:click={ () => Backend.chart.setType('balance') }>Balance</button>
			</div>
			<div class="type-button" title="The chart will show the market price of the asset." class:active={ $type === 'market' }>
				<button on:click={ () => Backend.chart.setType('market') }>Market</button>
			</div>
		{/if}

		<div class="expand"></div>

		<div class="metric no-mobile" title="Index (time offset) for debugging">
			I: { offset }
		</div>

		<div class="metric" title="Opening balance">
			O: { openMetric }
		</div>

		<div class="metric" title="Highest balance">
			H: { highMetric }
		</div>

		<div class="metric" title="Lowest balance">
			L: { lowMetric }
		</div>

		<div class="metric" title="Closing balance">
			C: { closeMetric }
		</div>

		<button class="reset-scroll" class:active={ isScrolledAway } title="Scroll to the right" on:click={ resetScrollView }>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
				<path d="M26.91425,13.12115,16.70709,23.32849a.99988.99988,0,0,1-1.41418,0L5.08575,13.12115a.50007.50007,0,0,1,0-.70715l2.8285-2.82806a.5.5,0,0,1,.70709,0L16,16.96436l7.37866-7.37842a.5.5,0,0,1,.70709,0l2.8285,2.82806A.50007.50007,0,0,1,26.91425,13.12115Z"/>
			</svg>
		</button>
	</div>

	<div class="chart-wrapper">
		<Chart
			{enableEma12}
			{enableEma26}
			on:tooltip={ updateTooltip }
			on:tooltipExit={ stopTooltip }
			on:scrolled={ updateScrollState }
			bind:resetScrollView={resetScrollView}
		/>
	</div>
</div>
