import {
  fetchUtxos,
  fetchTxHex,
  networks,
  UtxoInterface,
  walletFromAddresses,
  Wallet,
} from 'tdex-sdk';
import { Transaction, TxOutput } from 'liquidjs-lib';
import { info, error, log } from '../logger';
import State, { KeyStoreType } from '../state';
import { toSatoshi } from '../helpers';
//eslint-disable-next-line
const { NumberPrompt, Input, Confirm, Password } = require('enquirer');

const state = new State();

export default function (): void {
  info('=========*** Wallet ***==========\n');

  const { wallet, network } = state.get();

  if (!wallet.selected)
    return error(
      'A wallet is required. Create or restore with the wallet command'
    );

  const amount = new NumberPrompt({
    name: 'number',
    message: ' `How much do you want to send (eg. 0.05)?`',
  });
  const asset = new Input({
    message: 'Which asset you want to send?',
    initial: (networks as any)[network.chain].assetHash,
  });
  const recipient = new Input({
    message: 'Confidential address of the recipient',
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

  //Get balance with the explorer
  let senderUtxos: UtxoInterface[];
  let assetToBeSent: string;
  let addressToSend: string;
  let amountToBeSent: number;

  asset
    .run()
    .then((asset: string) => {
      assetToBeSent = asset;
      return amount.run();
    })
    .then((amount: number) => {
      amountToBeSent = toSatoshi(amount);

      return recipient.run();
    })
    .then((recipient: string) => {
      addressToSend = recipient;
      const promises = wallet.addressesWithBlindingKey.map(
        ({ confidentialAddress }) => {
          return fetchUtxos(confidentialAddress, network.explorer);
        }
      );
      return Promise.all(promises);
    })
    .then((utxos: UtxoInterface[][]) => {
      senderUtxos = utxos.flat();
      return Promise.all(
        utxos.map((utxo: any) => fetchTxHex(utxo.txid, network.explorer))
      );
    })
    .then((txHexs: string[]) => {
      return txHexs.map(
        (hex, index) => Transaction.fromHex(hex).outs[senderUtxos[index].vout]
      );
    })
    .then((outputs: TxOutput[]) => {
      senderUtxos.forEach((utxo: any, index: number) => {
        utxo.prevout = outputs[index];
      });

      return confirm.run();
    })
    .then((keepGoing: boolean) => {
      if (!keepGoing) throw 'Canceled';

      const execute =
        wallet.keystore.type === KeyStoreType.Encrypted
          ? () => password.run()
          : () => Promise.resolve(undefined);

      return execute();
    })
    .then((password?: string) => {
      const identity = state.getMnemonicIdentityFromState(password);
      // create a tx using wallet
      const senderWallet = walletFromAddresses(
        wallet.addressesWithBlindingKey,
        network.chain
      );
      const tx = senderWallet.createTx();

      const nextChangeAddress = identity.getNextChangeAddress();

      log('Creating and blinding transaction...');
      const unsignedTx = senderWallet.buildTx(
        tx,
        senderUtxos,
        addressToSend,
        amountToBeSent,
        assetToBeSent,
        nextChangeAddress.confidentialAddress
      );

      // cache the newly created address
      state.set({
        wallet: {
          addressesWithBlindingKey: [
            ...wallet.addressesWithBlindingKey,
            nextChangeAddress,
          ],
        },
      });

      return identity.signPset(unsignedTx);
    })
    .then((signedTx: string) => {
      // Get the tx in hex format ready to be broadcasted
      const hex = Wallet.toHex(signedTx);
      info(hex);
    })
    .catch(error);
}
