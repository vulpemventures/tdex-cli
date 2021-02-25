// @ts-nocheck
import axios from 'axios';
import { URL } from 'url';
import { AddressInterface, networks } from 'tdex-sdk';

import * as fs from 'fs';
import * as os from 'os';
import * as PathModule from 'path';

export const NETWORKS = {
  liquid: 'https://blockstream.info/liquid/api',
  regtest: 'https://nigiri.network/liquid/api',
};

export const TAXI_API_URL = {
  liquid: 'https://liquid-taxi.herokuapp.com',
  regtest: 'https://liquid-taxi.herokuapp.com',
};

export function getWalletInfo(addresses: AddressInterface[]): string {
  if (!addresses || addresses.length === 0)
    return '0 addresses in your wallet: use "wallet address" to generate new one';

  let walletInfo = 'Wallet addresses:\n\n';

  addresses.forEach(
    (
      { blindingPrivateKey, confidentialAddress }: AddressInterface,
      index: number
    ) => {
      walletInfo += `index: ${index}\naddress: ${confidentialAddress}\nblinding: ${blindingPrivateKey}\n\n`;
    }
  );

  return walletInfo;
}

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

export async function fetchTicker(
  asset: string,
  chain: string,
  url: string
): Promise<any> {
  if (asset === (networks as any)[chain].assetHash) return 'LBTC';
  try {
    const res = await axios.get(`${url}/asset/${asset}`);
    return res.data.ticker;
  } catch (ignore) {
    return undefined;
  }
}

export async function tickersFromMarkets(
  markets: Array<any>,
  chain: string,
  url: string
): Promise<any> {
  const marketsByTicker: any = {};
  let baseAssetTicker: string;

  for (let i = 0; i < markets.length; ++i) {
    const { baseAsset, quoteAsset } = markets[i];
    const previewLength = 4;
    if (!baseAssetTicker) {
      const ticker = await fetchTicker(baseAsset, chain, url);
      baseAssetTicker = ticker || baseAsset.substring(0, previewLength);
    }
    const ticker = await fetchTicker(quoteAsset, chain, url);
    const quoteAssetTicker = ticker || quoteAsset.substring(0, previewLength);
    const pair = `${baseAssetTicker}-${quoteAssetTicker}`;
    marketsByTicker[pair] = {
      [baseAsset]: baseAssetTicker,
      [quoteAsset]: quoteAssetTicker,
    };
  }
  return marketsByTicker;
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

export function readBinary(path: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let out: Uint8Array = new Uint8Array();
    const stream = fs.createReadStream(path);
    stream.on('data', (chunk) => (out = Buffer.concat([out, chunk])));
    stream.on('close', () => resolve(out));
    stream.on('error', reject);
  });
}

export function writeBinary(path: string, data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const stream = fs.createWriteStream(path);
      stream.write(data);
      stream.end();
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

export function fileExists(path: string): boolean {
  try {
    if (fs.existsSync(path)) {
      return true;
    }
    return false;
  } catch (ignore) {
    return false;
  }
}

export async function broadcastTx(
  hex: string,
  explorerUrlValue: string
): Promise<string> {
  try {
    const response = await axios.post(`${explorerUrlValue}/tx`, hex);
    return response.data;
  } catch (err) {
    throw err;
  }
}
