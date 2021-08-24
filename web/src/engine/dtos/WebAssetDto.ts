export interface WebAssetDto {
	ticker: string;
	name: string;
	quantity: number;
	price: WebAssetPriceDto;
	balance: WebAssetPriceDto;
	growthHour?: WebAssetPriceDto;
	growthDay?: WebAssetPriceDto;
	growthWeek?: WebAssetPriceDto;
	growthMonth?: WebAssetPriceDto;
	buys?: WebAssetOrderDto[];
	sells?: WebAssetOrderDto[];
}

export interface WebAssetPriceDto {
	dollars: number;
	trend: 'up' | 'down' | 'none';
	trendAmountDollars: number;
	trendAmountPercent: number;
}

export interface WebAssetOrderDto {
	quantity: number;
	price: number;
	amount: number;
	timestamp: number;
}
