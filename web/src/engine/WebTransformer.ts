import type { WebAssetDto } from './dtos/WebAssetDto';
import type { WebBalanceDto } from './dtos/WebBalanceDto';
import type { WebAsset } from './models/WebAsset';
import type { WebBalance } from './models/WebBalance';
import { createStore } from './util/stores';

/**
 * This is a helper class which transforms network objects (DTOs) into their equivalent local models for state
 * consumption.
 */
export class WebTransformer {

	/**
	 * Converts an array of `WebAssetDto` into store-driven `WebAsset` models.
	 *
	 * @param list
	 * @returns
	 */
	public getWebAssets(list: WebAssetDto[]): WebAsset[] {
		const totalDollarBalance = list.reduce((a, cur) => a + cur.balance.dollars, 0);

		return list.map(dto => {
			const holdingPercent = +(100 * (dto.balance.dollars / totalDollarBalance)).toFixed(4);
			const holdingPercentFormatted = holdingPercent.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			});

			return {
				ticker: dto.ticker,
				name: dto.name,
				holdings: createStore({
					percent: holdingPercent,
					percentFormatted: holdingPercentFormatted
				}),
				quantity: createStore(dto.quantity),
				price: createStore(dto.price),
				balance: createStore(dto.balance),
				growthHour: createStore(dto.growthHour),
				growthDay: createStore(dto.growthDay),
				growthWeek: createStore(dto.growthWeek),
				growthMonth: createStore(dto.growthMonth),
				buys: createStore(dto.buys ?? []),
				sells: createStore(dto.sells ?? [])
			};
		});
	}

	/**
	 * Converts a `WebBalanceDto` into a storable `WebBalance` model.
	 *
	 * @param dto
	 * @returns
	 */
	public getWebBalance(dto: WebBalanceDto): WebBalance {
		return {
			dollars: dto.dollars,
			dollarsFormatted: dto.dollars.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}),
			updatedAt: Date.now()
		};
	}

}
