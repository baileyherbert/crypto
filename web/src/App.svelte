<script lang="ts">
	import Asset from './components/assets/Asset.svelte';
	import ChartView from './components/chart/ChartView.svelte';
	import { Backend } from './globals';
	import type { WebAsset, WebAssetOrder} from './engine/models/WebAsset';
	import Sidebar from './Sidebar.svelte';

	const { accountBalance, assets, accountName, connected, connectionError } = Backend.state;

	let lastAccountBalance = 0;
	let memeContainer: HTMLDivElement;
	let lastMemeTime = Date.now();
	let selectedAsset: WebAsset;

	function selectAsset(asset: WebAsset) {
		if (selectedAsset === asset) {
			selectedAsset = undefined;
		}
		else {
			selectedAsset = asset;
		}

		const channel = selectedAsset ? (selectedAsset.ticker + '-USD') : '@total';
		Backend.chart.setChannel(channel);
	}

	const positiveMemes = [
		'WOW!',
		'wow',
		'MUCH COIN!',
		'much coin',
		'HOW MONEY!',
		'how money!',
		'SO CRYPTO!',
		'so crypto',
		'plz mine',
		'V RICH!',
		'v rich',
		'VERY CURRENCY!',
		'very currency',
		'SUCH AMAZE',
		'such amaze',
		'very mining!',
		'amaze',
		'very coins',
		'VERY COINS!',
		'want mine',
		'much master miner',
		'excite',
		'10/10 mine',
		'so happy',
		'much coin',
		'many coin',
		'MANY COIN!',
		'such pickaxe',
		'weeeeeee',
		'WEEEEEE!',
		'to the moon',
		'rocket booster',
	];

	const negativeMemes = [
		'oh no',
		'much loss',
		'very drop',
		'such fall',
		'scary',
		'spooky',
		'falling',
		'/10 mine',
		'to the ground',
		'much sad',
		'such pain',
		'so despair!',
		'HODL!',
		'wrong way!!',
		'ugly color',
		'gravity turn?',
		'very red!',
		'disappoint',
		'sadness',
		'grief',
		'pain and suffering',
		'very misery'
	];

	function renderMeme(type) {
		if (lastMemeTime < Date.now() - 300) {
			lastMemeTime = Date.now();

			const memes = type === 'positive' ? positiveMemes : negativeMemes;
			let text = memes[Math.floor(Math.random() * memes.length)];

			if (text.startsWith('/')) {
				text = Math.floor(Math.random() * 6) + text;
			}

			const el = document.createElement('span');
			el.innerText = text;
			el.classList.add(type);

			memeContainer.append(el);
			setTimeout(() => el.remove(), 3000);
		}
	}

	$: {
		if ($accountBalance.dollars !== lastAccountBalance) {
			if (lastAccountBalance !== 0) {
				const difference = $accountBalance.dollars - lastAccountBalance;

				if (difference >= ($accountBalance.dollars*1.3e-4)) {
					renderMeme('positive');
				}
				else if (difference <= -($accountBalance.dollars*1.3e-4)) {
					renderMeme('negative');
				}
				else if (lastMemeTime < Date.now() - 15000) {
					renderMeme(difference < 0 ? 'negative' : 'positive');
				}
			}

			lastAccountBalance = $accountBalance.dollars;
		}
	}
</script>

<svelte:head>
	<title>${ $accountBalance.dollarsFormatted } · { $accountName }'s Wallet</title>
</svelte:head>

{#if !$connected}
	<main class="loading">
		<div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div>

		{#if $connectionError}
		<div class="error">
			Waiting for backend
		</div>
		{/if}
	</main>
{/if}

<main>
	<div class="container">
		<div class="layout-vertical">
			<header>
				<div class="profile">
					<h1>${ $accountBalance.dollarsFormatted }</h1>
					<div class="meme" bind:this={ memeContainer }></div>
				</div>
			</header>
			<div class="table">
				<div class="header">
					<div class="columns">
						<div class="col asset">Asset</div>
						<div class="col holdings">Holdings</div>
						<div class="col sep"></div>
						<div class="col price">Price</div>
						<div class="col balance">Balance</div>
						<div class="col sep"><div></div></div>
						<div class="col growth mobile-2">Hour</div>
						<div class="col growth mobile-1">Day</div>
						<div class="col growth">Week</div>
						<div class="col growth">Month</div>
						<div class="col button"></div>
					</div>
				</div>
				<div class="body">
					{#each $assets as asset (asset.ticker)}
						<Asset {asset} on:click={ () => selectAsset(asset) } selected={ selectedAsset === asset } />
					{/each}
				</div>
			</div>
			<div class="chart">
				<ChartView {selectedAsset} />
			</div>
		</div>
	</div>
	{#if selectedAsset}
		<Sidebar asset={selectedAsset} />
	{/if}
</main>
