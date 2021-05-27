import { TraderClient } from 'tdex-sdk';
// Helpers
import { info, log, success, error } from '../logger';
import { isValidUrl, tickersFromMarkets } from '../helpers';
// State
import State, { initialState } from '../state';
const state = new State();

export default function (endpoint: string): void {
  info('=========*** Provider ***==========\n');

  const { network, provider } = state.get();
  if (!network) throw new Error('network is undefined');
  if (!provider) throw new Error('provider is undefined');

  if (!network.selected) return error('Select a valid network');

  if (!isValidUrl(endpoint))
    return error('The given endpoint URL is not valid');

  const client = new TraderClient(endpoint);
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
          endpoint,
          pairs,
          markets: marketsByTicker,
          selected: true,
        },
        market: initialState.market,
      });

      success(`Connection to the given provider has been successful!`);
      log(
        `Every command, such as market and trade, will be run against this provider`
      );
      log(`Current provider endpoint: ${endpoint}`);
      return;
    })
    .catch(error);
}
