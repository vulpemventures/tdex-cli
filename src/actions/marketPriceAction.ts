import { TraderClient, TradeType } from 'tdex-sdk';
import { info, log, error, success } from '../logger';

import State from '../state';
const state = new State();

export default function (): void {
  info('=========*** Market ***==========\n');

  const { market, provider } = state.get();

  if (!provider.selected)
    return error(
      'A provider is required. Select one with connect <endpoint> command'
    );

  if (!market.selected)
    return error('A market is required. Select one with market <pair> command');

  log(`Current market: ${market.pair}\n`);

  const client = new TraderClient(provider.endpoint);
  const { baseAsset, quoteAsset } = market.assets;
  client
    .marketPrice(
      {
        baseAsset,
        quoteAsset,
      },
      TradeType.BUY,
      1
    )
    .then((prices: any[]) => {
      const [first] = prices;

      info(
        `Swap fee of ${first.fee.basisPoint / 100}% to be paid in asset ${
          market.tickers[first.fee.asset]
        }\n`
      );

      const { quotePrice, basePrice } = first.price;

      success(
        `1 ${market.tickers[baseAsset]} is equal to ${quotePrice.toLocaleString(
          'en-US',
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8,
          }
        )} ${market.tickers[quoteAsset]}`
      );
      success(
        `1 ${market.tickers[quoteAsset]} is equal to ${basePrice.toLocaleString(
          'en-US',
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8,
          }
        )} ${market.tickers[baseAsset]}`
      );
    })
    .catch(error);
}
