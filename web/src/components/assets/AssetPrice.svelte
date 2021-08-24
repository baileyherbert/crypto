<script lang="ts">
	import type { WebAssetPrice } from 'src/engine/models/WebAsset';
	import type { Store } from 'src/engine/util/stores';
	import { formatDecimal, formatTrendPercent } from 'src/util/formatting';

	export let price: Store<WebAssetPrice | undefined>;
	export let valueMode: ValueMode = 'dollars';
	export let showSigns = false;
	export let precision: number | undefined = undefined;

	let autoPrecision = 2;
	let sign = '';

	type ValueMode = 'trendAmountDollars' | 'dollars';

	// Update positive or negative signage
	$: {
		if (showSigns && $price !== undefined) {
			sign = $price.trendAmountDollars < 0 ? '-' : '+';
		}
		else {
			sign = '';
		}
	}

	// Change the precision based on the price
	$: {
		if ($price) {
			if ($price[valueMode] < 10) {
				autoPrecision = 3;
			}

			else if ($price[valueMode] < 1000) {
				autoPrecision = 2;
			}

			else {
				autoPrecision = 0;
			}
		}
	}
</script>

<div class="component growth">
	{#if $price}
		<div class="value">{ sign }${ formatDecimal(Math.abs($price[valueMode]), precision ?? autoPrecision) }</div>
		<div class="percent" class:red={ $price.trend === 'down' } class:green={ $price.trend === 'up' }>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 8"><polygon points="8 0.01 0 8 16 8 8 0.01"/></svg>
			{ formatTrendPercent($price.trendAmountPercent) }%
		</div>
	{:else}
		<div class="none">
			-
		</div>
	{/if}
</div>
