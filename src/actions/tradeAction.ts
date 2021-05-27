import { BuySellOpts, Trade, TradeOpts, TradeType } from 'tdex-sdk';
import { info, log, error, success } from '../logger';

import State, { IdentityRestorerFromState, KeyStoreType } from '../state';
import { fromSatoshi, toSatoshi } from '../helpers';
import {
  fetchAndUnblindUtxos,
  greedyCoinSelector,
  IdentityInterface,
  IdentityOpts,
  IdentityType,
  Mnemonic,
  UtxoInterface,
} from 'tdex-sdk';
import { decrypt } from '../crypto';

const state = new State();
//eslint-disable-next-line
const { Toggle, NumberPrompt, Confirm, Password } = require('enquirer');

// 1. Fetch utxos
// 2. CHeck if input amount is enough
// 3. AMOUNT_P of ASSET_P and receiving AMOUNT_R of ASSET_R
// 4. Send SwapRequest message and parse SwapAccept message
// 5. Sign the final psbt
// 6. Send SwapComplete back

export default function () {
  info('=========*** Trade ***==========\n');

  const { wallet, provider, market, network } = state.get();
  if (!wallet) throw new Error('wallet is undefined');
  if (!network) throw new Error('network is undefined');
  if (!provider) throw new Error('provider is undefined');
  if (!market) throw new Error('market is undefined');

  if (!network.selected) return error('Select a valid network first');

  if (!provider.selected)
    return error(
      'A provider is required. Select one with connect <endpoint> command'
    );

  if (!market.selected)
    return error('A market is required. Select one with market <pair> command');

  if (!wallet.selected)
    return error('A wallet is required. Create or restore with wallet command');

  const toggle = new Toggle({
    message:
      'Do you want to buy or sell ' +
      market.tickers[market.assets.baseAsset] +
      '?',
    enabled: 'BUY',
    disabled: 'SELL',
  });
  const amount = (message: string) =>
    new NumberPrompt({
      name: 'number',
      message,
    });
  const confirm = new Confirm({
    name: 'question',
    message: 'Are you sure continue?',
  });
  const password = new Password({
    type: 'password',
    name: 'key',
    message: 'Type your password',
  });

  let toBeSent: string,
    toReceive: string,
    amountToBeSent: number,
    amountToReceive: number,
    isBuyType: boolean,
    trade: Trade;

  toggle
    .run()
    .then((_isBuyType: boolean) => {
      isBuyType = _isBuyType;
      const { baseAsset, quoteAsset } = market.assets;
      if (isBuyType) {
        toBeSent = quoteAsset;
        toReceive = baseAsset;
      } else {
        toBeSent = baseAsset;
        toReceive = quoteAsset;
      }

      return amount(
        `How much do you want to ${isBuyType ? 'buy' : 'sell'} (eg. 0.05)?`
      ).run();
    })
    .then((inputAmount: number) => {
      if (isBuyType) {
        amountToReceive = toSatoshi(inputAmount);
      } else {
        amountToBeSent = toSatoshi(inputAmount);
      }
      return Promise.resolve();
    })
    .then(() => {
      const utxos = fetchAndUnblindUtxos(
        wallet.addressesWithBlindingKey,
        network.explorer
      );
      return utxos;
    })
    .then((utxos: UtxoInterface[]) => {
      const init: TradeOpts = {
        providerUrl: provider.endpoint,
        explorerUrl: network.explorer,
        coinSelector: greedyCoinSelector(),
        utxos,
      };

      // Fetch market rate from daemon and calulcate prices for each ticker
      const tradeType = isBuyType ? TradeType.BUY : TradeType.SELL;
      const amount = isBuyType ? amountToReceive : amountToBeSent;

      trade = new Trade(init);
      return trade.preview({
        market: {
          baseAsset: market.assets.baseAsset,
          quoteAsset: market.assets.quoteAsset,
        },
        tradeType,
        amount,
        asset: market.assets.baseAsset,
      });
    })
    .then((preview: any) => {
      if (isBuyType) {
        amountToBeSent = preview.amountToBeSent;
      } else {
        amountToReceive = preview.amountToReceive;
      }

      log(
        `Gotcha! You will send ${market.tickers[toBeSent]} ${fromSatoshi(
          amountToBeSent
        )} and receive ${market.tickers[toReceive]} ${fromSatoshi(
          amountToReceive
        )}`
      );

      return confirm.run();
    })
    .then((keepGoing: boolean) => {
      if (!keepGoing) throw 'Canceled';
      const execute =
        wallet.keystore.type === KeyStoreType.Encrypted
          ? () => password.run()
          : () => Promise.resolve(wallet.keystore.value);

      return execute();
    })
    .then((passwordOrWif: string) => {
      const seed =
        wallet.keystore.type === KeyStoreType.Encrypted
          ? decrypt(wallet.keystore.value, passwordOrWif)
          : passwordOrWif;

      const identityOptions: IdentityOpts = {
        chain: network.chain,
        type: IdentityType.Mnemonic,
        value: {
          mnemonic: seed,
        },
        initializeFromRestorer: true,
        restorer: new IdentityRestorerFromState(wallet),
      };

      const identity = new Mnemonic(identityOptions);
      const execute = async () => {
        await identity.isRestored;
        return identity;
      };

      return execute();
    })
    .then((identity: IdentityInterface) => {
      log(`\nSending Trade proposal to provider...`);
      log('Signing with private key...');

      const params: BuySellOpts = {
        market: market.assets,
        amount: isBuyType ? amountToReceive : amountToBeSent,
        asset: market.assets.baseAsset,
        identity,
      };

      const execute = isBuyType
        ? () => trade.buy(params)
        : () => trade.sell(params);

      const returnPromise = async () => {
        const txid = await execute();
        // overwrite the addresses cache in state
        const addresses = await identity.getAddresses();
        state.set({
          wallet: {
            ...wallet,
            addressesWithBlindingKey: addresses,
          },
        });
        return txid;
      };

      return returnPromise();
    })
    .then((txid: string) => {
      success('Trade completed!\n');
      info(`tx hash ${txid}`);
    })
    .catch(error);
}
