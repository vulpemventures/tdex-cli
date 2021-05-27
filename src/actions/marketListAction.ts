import { info, log, success, error } from '../logger';

import State from '../state';
import { TraderClient } from 'tdex-sdk';
import { tickersFromMarkets } from '../helpers';
const state = new State();

export default function () {
  info('=========*** Market ***==========\n');

  const { provider, market, network } = state.get();
  if (!network) throw new Error('network is undefined');
  if (!provider) throw new Error('provider is undefined');
  if (!market) throw new Error('market is undefined');

  if (!network.selected) return error('Select a valid network');

  if (!provider.selected)
    return error(
      'A provider is required. Select one with connect <endpoint> command'
    );

  const client = new TraderClient(provider.endpoint);
  client
    .markets()
    .then((markets) =>
      tickersFromMarkets(markets, network.chain, network.explorer)
    )
    .then((marketsByTicker) => {
      const pairs = Object.keys(marketsByTicker);

      state.set({
        provider: {
          ...provider,
          pairs,
          markets: marketsByTicker,
        },
      });

      if (pairs.length === 0) return log(`No tradable markets found`);

      pairs.forEach((p) =>
        p === market.pair ? success(`${p} (selected)`) : log(p)
      );
    })
    .catch(error);
}
