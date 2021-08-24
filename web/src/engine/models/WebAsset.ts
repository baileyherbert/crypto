import type { Store } from '../util/stores';

/**
 * Represents an asset.
 */
export interface WebAsset {
	ticker: string;
	name: string;
	quantity: Store<number>;
	holdings: Store<WebAssetHoldings>;
	price: Store<WebAssetPrice>;
	balance: Store<WebAssetPrice>;
	growthHour: Store<WebAssetPrice | undefined>;
	growthDay: Store<WebAssetPrice | undefined>;
	growthWeek: Store<WebAssetPrice | undefined>;
	growthMonth: Store<WebAssetPrice | undefined>;
	buys: Store<WebAssetOrder[]>;
	sells: Store<WebAssetOrder[]>;
}

/**
 * Represents a dollar amount which is tracked for growth or decline.
 */
export interface WebAssetPrice {
	dollars: number;
	trend: 'up' | 'down' | 'none';
	trendAmountDollars: number;
	trendAmountPercent: number;
}

/**
 * Represents the fractional weight of this asset in a portfolio.
 */
export interface WebAssetHoldings {
	percent: number;
	percentFormatted: string;
}

/**
 * Represents a buy or sell order for an asset.
 */
export interface WebAssetOrder {
	quantity: number;
	price: number;
	amount: number;
	timestamp: number;
}
