import { info, log } from '../logger';

import State from '../state';
const state = new State();

export default function (): void {
  info('=========*** Info ***==========\n');

  const { market, provider, network, wallet } = state.get();
  if (!wallet) throw new Error('wallet is undefined');
  if (!network) throw new Error('network is undefined');
  if (!provider) throw new Error('provider is undefined');
  if (!market) throw new Error('market is undefined');

  const infos: Array<string> = [];
  if (network.selected)
    infos.push(`Network: ${network.chain}\nExplorer: ${network.explorer}`);

  if (provider.selected) infos.push(`Provider endpoint: ${provider.endpoint}`);

  if (market.selected) infos.push(`Market: ${market.pair}`);

  if (wallet.selected)
    infos.push(
      `Number of wallet addresses: ${wallet.addressesWithBlindingKey.length}`
    );

  if (infos.length === 0)
    return log(`State is empty. Start configuring the CLI`);

  infos.forEach((info: string) => log(info));
}
