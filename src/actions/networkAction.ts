/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { info, log, error } from '../logger';
import State from '../state';
import { isValidUrl, NETWORKS } from '../helpers';
const state = new State();

export default function (chain: string, cmdObj: any): void {
  info('=========*** Network ***==========\n');

  if (!Object.keys(NETWORKS).includes(chain)) return info('Invalid network');

  state.set({
    network: { selected: true, chain, explorer: (NETWORKS as any)[chain] },
  });

  const { network } = state.get();
  if (cmdObj.explorer) {
    if (!isValidUrl(cmdObj.explorer))
      return error('The provided endpoint URL is not valid');

    state.set({ network: { ...network!, explorer: cmdObj.explorer } });
  }

  log(
    `Current network: ${network?.chain}\nCurrent explorer: ${network?.explorer}`
  );
}
