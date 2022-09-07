<script lang="ts">
	import CurrencyIcon from './components/CurrencyIcon.svelte';
	import type { WebAsset, WebAssetOrder, WebAssetPrice } from './engine/models/WebAsset';
	import type { Store } from './engine/util/stores';

	export let asset: WebAsset;

	let buys: Store<WebAssetOrder[]>;
	let sells: Store<WebAssetOrder[]>;
	let price: Store<WebAssetPrice>;
	let quantity: Store<number>;

	$: buys = asset.buys;
	$: sells = asset.sells;
	$: price = asset.price;
	$: quantity = asset.quantity;

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

	let qtyBought = 0;
	let qtyMined = 0;
	let qtySold = 0;
	let totalInvested = 0;
	let totalSold = 0;
	let totalEarned = 0;
	let returnOnInvestment = 0;
	let returnPercent = 0;

	$: {
		qtyBought = $buys.reduce<number>((total, row) => total + row.quantity, 0);
		qtySold = $sells.reduce<number>((total, row) => total + row.quantity, 0);
		qtyMined = $quantity - (qtyBought - qtySold);

		totalInvested = $buys.reduce<number>((total, row) => total + row.amount, 0);
		totalSold = $sells.reduce<number>((total, row) => total + row.amount, 0);
		totalEarned = 0;

		for (const order of $buys) {
			const worthNow = $price.dollars * order.quantity;
			const difference = worthNow - order.amount;

			totalEarned += difference;
		}

		returnOnInvestment = totalEarned;
		returnPercent = Math.floor(100 * (returnOnInvestment / totalInvested));
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

	<section class="shrink stats">
		<div class="heading border-top">
			<h2>Statistics</h2>
		</div>

		<table class="table">
			<tbody>
				<tr>
					<td>
						Quantity bought
					</td>
					<td class="mono">
						{ formatQuantity(qtyBought) }
					</td>
				</tr>
				<tr>
					<td>
						Quantity created
					</td>
					<td class="mono">
						{ formatQuantity(qtyMined) }
					</td>
				</tr>

				<tr class="border">
					<td colspan="2"><div></div></td>
				</tr>

				<tr>
					<td>
						Amount invested
					</td>
					<td class="mono">
						${ formatPrice(totalInvested) }
					</td>
				</tr>
				<tr>
					<td>
						Amount earned
					</td>
					<td class="mono">
						${ formatPrice(totalEarned) }
					</td>
				</tr>

				<tr class="border">
					<td colspan="2"><div></div></td>
				</tr>

				<tr>
					<td>
						Return on investments
					</td>
					<td class="mono" class:green={returnOnInvestment >= 0} class:red={returnOnInvestment < 0}>
						${ formatPrice(Math.abs(returnOnInvestment)) }
						({ returnPercent }%)
					</td>
				</tr>
				<tr>
					<td>
						Total sold
					</td>
					<td class="mono" class:red={totalSold > 0}>
						${ formatPrice(totalSold) }
					</td>
				</tr>
			</tbody>
		</table>
	</section>
</div>
