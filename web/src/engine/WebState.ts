import type { WebAssetDto } from './dtos/WebAssetDto';
import { ChartManager } from './managers/ChartManager';
import type { WebAsset } from './models/WebAsset';
import type { WebBalance } from './models/WebBalance';
import type { WebChartData } from './models/WebChart';
import { createStore } from './util/stores';

/**
 * This class manages all state which is received from the backend.
 *
 * It provides the actual state repositories as properties. Not all of these repositories will be stores. Instead,
 * some might be arrays or objects containing stores. In addition, it's possible for stores to exist within stores for
 * the purpose of rendering optimization.
 *
 * There are also methods available to manipulate all state repositories. Behind the scenes, these methods optimize
 * their writing stategies for best efficiency.
 */
export class WebState {

	/**
	 * A store indicating whether or not we're connected to the backend.
	 */
	public connected = createStore<boolean>(false);

	/**
	 * A store indicating whether or not we're currently encountering an error when connecting.
	 */
	public connectionError = createStore<boolean>(false);

	/**
	 * A store containing the current account's name.
	 */
	public accountName = createStore<string>('Unknown');

	/**
	 * A store containing the current account's balance.
	 */
	public accountBalance = createStore<WebBalance>({
		dollars: 0,
		dollarsFormatted: '0.00',
		updatedAt: 0
	});

	/**
	 * A store containing an ongoing, progress-tracked task.
	 */
	public task = createStore<Task | undefined>(undefined);

	/**
	 * A store containing an array of all assets under the current account. This store will only be updated if the
	 * order of the assets (sorted by relative percent of holdings) changes.
	 */
	public assets = createStore<WebAsset[]>([]);

	/**
	 * Overwrites the assets array. This is extremely inefficient and should only be invoked if the array order
	 * changes or if there is new data.
	 *
	 * @param assets
	 */
	public setAssets(assets: WebAsset[]) {
		this.assets.set(assets);
	}

	/**
	 * Overwrites the account name.
	 *
	 * @param name
	 */
	public setAccountName(name: string) {
		this.accountName.set(name);
	}

	/**
	 * Overwrites the account balance.
	 *
	 * @param balance
	 */
	public setAccountBalance(balance: WebBalance) {
		this.accountBalance.set(balance);
	}

	/**
	 * Updates the asset in the state whose ticker matches the given data. Only the values that have changed will be
	 * applied to the state.
	 *
	 * @param dto
	 */
	public updateAsset(dto: WebAssetDto) {
		const existing = this.getAsset(dto.ticker);

		if (existing === undefined) {
			return;
		}

		const existingQuantity = existing.quantity.get();

		// Update quantity
		if (dto.quantity !== existingQuantity) {
			existing.quantity.set(dto.quantity);
		}

		// Update prices
		existing.price.set(dto.price);
		existing.balance.set(dto.balance);
		existing.growthHour.set(dto.growthHour);
		existing.growthDay.set(dto.growthDay);
		existing.growthWeek.set(dto.growthWeek);
		existing.growthMonth.set(dto.growthMonth);
	}

	/**
	 * Returns the `WebAsset` model that matches the given ticker.
	 *
	 * @param ticker
	 * @returns
	 */
	public getAsset(ticker: string) {
		for (const asset of this.assets.get()) {
			if (asset.ticker === ticker) {
				return asset;
			}
		}
	}

}

export interface Task {
	text: string;
	progress: number;
}
