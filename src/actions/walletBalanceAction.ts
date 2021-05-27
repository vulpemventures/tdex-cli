import { fetchBalances } from 'ldk';
import { info, error, success, log } from '../logger';
import { fetchTicker } from '../helpers';
import State from '../state';
const state = new State();

interface BalanceResult {
  amount: number;
  asset: string;
  ticker: string;
}

async function getBalance(
  address: string,
  blindingPrivateKey: string,
  explorerUrl: string,
  chain: string
): Promise<BalanceResult[]> {
  const balances = await fetchBalances(
    address,
    blindingPrivateKey,
    explorerUrl
  );
  const entries = Object.entries(balances);
  const promises = entries.map(async ([asset, balance]) => {
    const ticker = await fetchTicker(asset, chain, explorerUrl)
      .then((response) => response || 'Unknown')
      .catch(() => 'Unknown');
    const amount = balance as number;
    return { asset, amount, ticker };
  });

  return Promise.all(promises);
}

function reducer(
  accumulator: BalanceResult[],
  current: BalanceResult[]
): BalanceResult[] {
  current.forEach((res: BalanceResult) => {
    const indexInAccumulator = accumulator.findIndex(
      (r) => r.asset.valueOf() === res.asset.valueOf()
    );
    if (indexInAccumulator >= 0)
      accumulator[indexInAccumulator].amount += res.amount;
    else accumulator.push(res);
  });

  return accumulator;
}

export default function (): void {
  info('=========*** Wallet ***==========\n');

  const { wallet, network } = state.get();

  if (!wallet) throw new Error('wallet is undefined');
  if (!network) throw new Error('network is undefined');

  if (!wallet.selected)
    return error(
      'A wallet is required. Create or restore with the wallet command'
    );

  // if (entries.lddength === 0) return log('No transactions found.');
  const fetchBalancesPromises = wallet.addressesWithBlindingKey.map(
    ({ confidentialAddress, blindingPrivateKey }) => {
      return getBalance(
        confidentialAddress,
        blindingPrivateKey,
        network.explorer,
        network.chain
      );
    }
  );

  Promise.all(fetchBalancesPromises)
    .then((results: BalanceResult[][]) => {
      const balances = results.slice(1).reduce(reducer, results[0]);
      if (balances.length === 0) return log('No transactions found.');
      balances.forEach(({ asset, ticker, amount }) => {
        success(`*** ${ticker} ***`);
        log(`Balance ${amount} satoshis`);
        log(`Asset hash: ${asset}`);
      });
      return;
    })
    .catch(error);
}
