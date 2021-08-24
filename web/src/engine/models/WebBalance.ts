import { WebAssetPrice } from './WebAsset';

/**
 * Represents an account balance.
 */
export interface WebBalance {
	dollars: number;
	dollarsFormatted: string;
	updatedAt: number;
	growthHour?: WebAssetPrice;
	growthDay?: WebAssetPrice;
	growthWeek?: WebAssetPrice;
	growthMonth?: WebAssetPrice;
}
