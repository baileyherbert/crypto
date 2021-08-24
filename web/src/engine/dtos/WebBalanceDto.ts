import { WebAssetPriceDto } from './WebAssetDto';

export interface WebBalanceDto {
	dollars: number;
	growthHour?: WebAssetPriceDto;
	growthDay?: WebAssetPriceDto;
	growthWeek?: WebAssetPriceDto;
	growthMonth?: WebAssetPriceDto;
}
