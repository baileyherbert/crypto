<script lang="ts">
	import Asset from './components/assets/Asset.svelte';
	import ChartView from './components/chart/ChartView.svelte';
	import { Backend } from './globals';
	import type { WebAsset, WebAssetOrder} from './engine/models/WebAsset';
	import Sidebar from './Sidebar.svelte';

	const { accountBalance, assets, accountName, connected, connectionError, task } = Backend.state;

	let lastAccountBalance = 0;
	let memeContainer: HTMLDivElement;
	let lastMemeTime = Date.now();
	let selectedAsset: WebAsset;

	function selectAsset(asset: WebAsset) {
		if (asset.ticker === 'USD') {
			return;
		}

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
		'rocket fuel!!1',
		'in doge we trust',
		'#OccupyMars',
		'much rising',
		'many fast',
		'very speed',
		'very profit',
		'new! value!!',
		'owo',
		'crypto go brrrr lol',
		'such money. very wow!',
		'such investing',
		'hooman gibme treat plz',
		'what does the future hodl?',
		'very space',
		'zoom',
		'🚀',
	];

	const negativeMemes = [
		'wuh woh',
		'much loss',
		'very drop',
		'such fall',
		'scary!!',
		'spooky...',
		'falling',
		'fear intensifying',
		'/10 mine',
		'to the ground',
		'much sad',
		'such pain',
		'HODL!',
		'wrong way!!',
		'such an ugly color',
		'very down!',
		'great sadness',
		'wubba lubba dub dub',
		'space too high',
		'low fuel',
		'no regrets',
		'moon grows ever further...',
		'* lunar lander not included',
		'so scare',
		'concern',
		'*holds shiba inu in fear*',
		'flight diverted',
		'aaah! bear attack!!!',
		'¯\\_(ツ)_/¯',
		'such danger',
		'very scare',
	];

	const dayPositives = [
		'shiny sunday ✨',
		'magical monday 🔮',
		'terrific tuesday 👍',
		'wealthy wednesday 🤑',
		'thriving thursday 🔥',
		'fantastic friday 💖',
		'super saturday 🦸‍♂️'
	];

	const dayNegatives = [
		'sadness sunday 😢',
		'miserable monday 😭',
		'tragedy tuesday 💀',
		'worthless wednesday 📉',
		'typical thursday 🤷‍♂️',
		'failure friday 💥',
		'shaky saturday 🌪'
	];

	function renderMeme(type) {
		if (lastMemeTime < Date.now() - 300) {
			lastMemeTime = Date.now();

			// Get the memes for today
			const memes = type === 'positive' ? [...positiveMemes] : [...negativeMemes];
			const dayMemes = type === 'positive' ? dayPositives : dayNegatives;

			// Add the day meme for today
			const dayNumber = new Date().getDay();
			memes.push(dayMemes[dayNumber]);

			// Get a random meme :D
			let text = memes[Math.floor(Math.random() * memes.length)];

			if (text.startsWith('/')) {
				text = Math.floor(Math.random() * 6) + text;
			}

			if (Math.random() < 0.00065) {
				text = '🥚 easter egg lol';
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
						<div class="col sep border-empty"><div></div></div>
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

{#if $task}
<div class="task">
	<div class="task-wrapper">
		<div class="details">
			<div class="text">{$task.text}</div>
			<div class="bar">
				<div class="progress" style="width: {$task.progress}%;"></div>
			</div>
		</div>
	</div>
</div>
{/if}
