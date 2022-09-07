<script lang="ts">
	import CurrencyIcon from 'src/components/CurrencyIcon.svelte';
	import type { WebAsset } from 'src/engine/models/WebAsset';
	import { formatDecimal } from 'src/util/formatting';
	import AssetPrice from './AssetPrice.svelte';

	export let asset: WebAsset;
	export let selected: boolean;

	// Core data
	const holdings = asset.holdings;
	const quantity = asset.quantity;
	const price = asset.price;
	const balance = asset.balance;

	// Growth trackers
	const growthHour = asset.growthHour;
	const growthDay = asset.growthDay;
	const growthWeek = asset.growthWeek;
	const growthMonth = asset.growthMonth;
</script>

<div class="row" on:click class:selected={ selected }>
	<div class="columns">
		<div class="col asset">
			<div class="component currency">
				<div class="icon">
					<CurrencyIcon icon={asset.ticker} />
				</div>
				<div class="name">
					{asset.name}
				</div>
			</div>
		</div>
		<div class="col holdings">
			<div class="component percent">
				<div class="value">
					<div class="left">{ $holdings.percentFormatted }%</div>
					<div class="right">{ formatDecimal($quantity, 8) }</div>
				</div>
				<div class="bar">
					<div class="progress" style="width: {$holdings.percent}%;"></div>
				</div>
			</div>
		</div>
		<div class="col sep"></div>
		<div class="col price">
			<AssetPrice price={price} />
		</div>
		<div class="col balance">
			<AssetPrice price={balance} />
		</div>
		<div class="col sep border"><div></div></div>
		<div class="col growth mobile-2">
			{#if asset.ticker !== 'USD'}
				<AssetPrice price={growthHour} valueMode='trendAmountDollars' showSigns={true} />
			{:else}
				<div class="none">-</div>
			{/if}
		</div>
		<div class="col growth mobile-1">
			{#if asset.ticker !== 'USD'}
				<AssetPrice price={growthDay} valueMode='trendAmountDollars' showSigns={true} />
			{:else}
				<div class="none">-</div>
			{/if}
		</div>
		<div class="col growth">
			{#if asset.ticker !== 'USD'}
				<AssetPrice price={growthWeek} valueMode='trendAmountDollars' showSigns={true} />
			{:else}
				<div class="none">-</div>
			{/if}
		</div>
		<div class="col growth">
			{#if asset.ticker !== 'USD'}
				<AssetPrice price={growthMonth} valueMode='trendAmountDollars' showSigns={true} />
			{:else}
				<div class="none">-</div>
			{/if}
		</div>
		<div class="col button"></div>
	</div>
	<div class="details">
		<div class="item">
			<div class="period">Last hour</div>
			<div class="value">+ $1.00</div>
			<div class="percent">(23.58%)</div>
		</div>
		<div class="item">
			<div class="period">Last day</div>
			<div class="value">+ $1.00</div>
			<div class="percent">(23.58%)</div>
		</div>
		<div class="item">
			<div class="period">Last week</div>
			<div class="value">+ $1.00</div>
			<div class="percent">(23.58%)</div>
		</div>
		<div class="item">
			<div class="period">Last month</div>
			<div class="value">+ $1.00</div>
			<div class="percent">(23.58%)</div>
		</div>
	</div>
</div>
