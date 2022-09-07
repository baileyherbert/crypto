import { LogConsoleWriter, Logger } from '@baileyherbert/common';
import fs from 'fs';
import path from 'path';
import { Account } from './core/Account';
import { MarketPriceTracker } from './core/MarketPriceTracker';
import { Ticker } from './core/Ticker';
import { WebManager } from './http/WebManager';

export class Main {

	public static rootdir = path.resolve(__dirname, '..');
	public static logger = new Logger('app');

	public static accounts = new Array<Account>();
	public static ticker: Ticker;
	public static config: any;
	public static web = new WebManager();

	public static markets = new Map<string, MarketPriceTracker>();

	public static async main() {
		const writer = new LogConsoleWriter(0);
		writer.mount(this.logger);

		this.config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../', 'config.json')).toString());
		this.ticker = new Ticker(this.config.ticker);
		await this.ticker.start();

		// Create the accounts
		for (const conf of this.config.accounts) {
			const account = new Account(conf);
			this.accounts.push(account);
		}

		// Create market trackers
		for (const name of this.ticker.currencies) {
			const tracker = new MarketPriceTracker(name);
			this.markets.set(name, tracker);

			// Register all accounts so the tracker can respond to subscriptions
			for (const account of this.accounts) {
				tracker.registerAccount(account);
			}
		}

		// Start forwarding ticker data to market trackers
		this.ticker.on('change', (assetName, price) => {
			const tracker = this.markets.get(assetName);

			if (tracker !== undefined) {
				tracker.updateTickerPrice(price);
			}
		});

		// Start accounts simultaneously
		this.logger.info('Starting accounts...');
		await Promise.all(this.accounts.map(account => account.start()));

		this.logger.info('Starting socket server...');
		this.web.start();

		this.logger.info('Ready.');
	}

	public static getCryptoName(ticker: string) {
		switch (ticker) {
			case 'BTC': return 'Bitcoin';
			case 'ETH': return 'Ether';
			case 'ADA': return 'Cardano';
			case 'DOGE': return 'Dogecoin';
			case 'DOT': return 'Polkadot';
			case 'XTZ': return 'Tezos';
			case 'SKL': return 'Skale';
			case 'SOL': return 'Solana';
			case 'LTC': return 'Litecoin';
			case 'BCH': return 'Bitcoin Cash';
			case 'XLM': return 'Stellar';
			case 'ETC': return 'Ether Classic';
			case 'IOTX': return 'IoTeX';
			case 'ALGO': return 'Algorand';
			case 'USD': return 'US Dollar';
		}

		return 'Unknown';
	}

}

Main.main();
