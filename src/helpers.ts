// @ts-nocheck
import { URL } from 'url';

export const NETWORKS = {
  liquid: 'https://blockstream.info/liquid/api',
  regtest: 'https://nigiri.network/liquid/api',
};

export const TAXI_API_URL = {
  liquid: 'https://liquid-taxi.herokuapp.com',
  regtest: 'https://liquid-taxi.herokuapp.com',
};

export function toSatoshi(x: number): number {
  return Math.floor(x * Math.pow(10, 8));
}

export function fromSatoshi(x: number): number {
  return Number(
    (x / Math.pow(10, 8))
      .toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 8,
      })
      .replace(',', '')
  );
}

export function tickersFromMarkets(markets: Array<any>): any {
  const marketsByTicker: any = {};
  markets.forEach(({ baseAsset, quoteAsset }) => {
    const previewLength = 4;
    const basePrefix = baseAsset.substring(0, previewLength);
    const quotePrefix = quoteAsset.substring(0, previewLength);
    const ticker = `${basePrefix}-${quotePrefix}`;
    marketsByTicker[ticker] = {
      [basePrefix]: baseAsset,
      [quotePrefix]: quoteAsset,
    };
  });
  return marketsByTicker;
}

export function makeid(length: number): string {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

export function isValidUrl(s) {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
}

export function mergeDeep(...objects) {
  const isObject = (obj) => obj && typeof obj === 'object';

  return objects.reduce((prev, obj) => {
    Object.keys(obj).forEach((key) => {
      const pVal = prev[key];
      const oVal = obj[key];

      if (Array.isArray(pVal) && Array.isArray(oVal)) {
        prev[key] = [...oVal];
      } else if (isObject(pVal) && isObject(oVal)) {
        prev[key] = mergeDeep(pVal, oVal);
      } else {
        prev[key] = oVal;
      }
    });

    return prev;
  }, {});
}
