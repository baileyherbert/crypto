<script lang="ts">
	import CurrencyIcon from './components/CurrencyIcon.svelte';
	import type { WebAsset, WebAssetOrder, WebAssetPrice } from './engine/models/WebAsset';
	import type { Store } from './engine/util/stores';

	export let asset: WebAsset;

	let buys: Store<WebAssetOrder[]>;
	let sells: Store<WebAssetOrder[]>;
	let price: Store<WebAssetPrice>;

	$: buys = asset.buys;
	$: sells = asset.sells;
	$: price = asset.price;

	function formatQuantity(input: number) {
		const majorLength = Math.floor(input).toString().length;
		const precision = 9 - majorLength;

		return input.toFixed(precision);
	}

	function formatPrice(price: number) {
		if (price >= 1000) {
			return price.toFixed(0);
		}

		return price.toFixed(3);
	}

	function formatDate(timestamp: number) {
		const date = new Date(timestamp);
		const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
		const day = date.getDate();

		return month + ' ' + day;
	}

	function formatBuyReturns(order: WebAssetOrder, currentValue: number) {
		const worthNow = currentValue * order.quantity;
		const difference = worthNow - order.amount;

		return formatPrice(Math.abs(difference));
	}

	function formatSellReturns(order: WebAssetOrder, currentValue: number) {
		const worthNow = currentValue * order.quantity;
		const difference = -(worthNow - order.amount);

		return formatPrice(Math.abs(difference));
	}
</script>

<div class="sidebar">
	<section class="shrink asset">
		<div class="icon">
			<CurrencyIcon icon={ asset.ticker } />
		</div>
		<div class="name">
			<h2>{ asset.name }</h2>
			<strong>{ asset.ticker }</strong>
		</div>
	</section>
	<section>
		<div class="heading">
			<h2>Buy orders</h2>
		</div>
		<div class="investments">
			<table class="table">
				<thead>
					<tr>
						<th title="The amount of the asset purchased in this transaction.">Quantity</th>
						<th title="The dollar value of the asset at the time of purchase.">Price</th>
						<th title="The total amount of dollars you spent on this transaction.">Cost</th>
						<th class="center">Date</th>
						<th class="right" title="The amount of money you've made or lost so far by investing at this particular time.">Return</th>
					</tr>
				</thead>
				<tbody>
					{#each $buys as order}
					<tr>
						<td class="mono">{ formatQuantity(order.quantity) }</td>
						<td class="mono">${ formatPrice(order.price) }</td>
						<td class="mono">${ formatPrice(order.amount) }</td>
						<td class="center">{ formatDate(order.timestamp) }</td>
						<td
							class="mono right"
							class:green={ $price.dollars >= order.price }
							class:red={ $price.dollars < order.price }
						>
							${ formatBuyReturns(order, $price.dollars) }
						</td>
					</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section>
		<div class="heading border-top">
			<h2>Sell orders</h2>
		</div>

		<table class="table">
			<thead>
				<tr>
					<th title="The amount of the asset sold in this transaction.">Quantity</th>
					<th title="The dollar value of the asset at the time of purchase.">Price</th>
					<th title="The total amount of dollars you gained on this transaction.">Amount</th>
					<th class="center">Date</th>
					<th class="right" title="The amount of money you've lost or saved so far by selling at this particular time.">Return</th>
				</tr>
			</thead>
			<tbody>
				{#each $sells as order}
				<tr>
					<td class="mono">{ formatQuantity(order.quantity) }</td>
					<td class="mono">${ formatPrice(order.price) }</td>
					<td class="mono">${ formatPrice(order.amount) }</td>
					<td class="center">{ formatDate(order.timestamp) }</td>
					<td
						class="mono right"
						class:green={ $price.dollars <= order.price }
						class:red={ $price.dollars > order.price }
					>
						${ formatSellReturns(order, $price.dollars) }
					</td>
				</tr>
				{/each}
			</tbody>
		</table>
	</section>

	<section class="shrink">
		<div class="heading border-top">
			<h2>Alerts</h2>
		</div>

		<p>Coming soon!</p>
	</section>
</div>
