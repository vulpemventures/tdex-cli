import { info, log, error } from '../logger';
//Helpers
import { isValidUrl } from '../helpers';

import State from '../state';
import { networks } from 'liquidjs-lib';

const markets = require("../markets.example.json")
const state = new State();

export default function (endpoint: string): void {
  info('=========*** Provider ***==========\n');

  if (!isValidUrl(endpoint))
    return error('The provided endpoint URL is not valid');

  // TODO: Connect to provided endpoint and fetch the available pairs
  // client.Markets().then()


  const pairs = Object.keys(markets)

  state.set({
    provider: {
      endpoint,
      pairs,
      markets,
      selected: true
    }
  });

  return log(`Current provider endpoint: ${endpoint}`)
}