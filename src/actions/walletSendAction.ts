import {
  fetchUtxos,
  fetchTxHex,
  networks,
  UtxoInterface,
  walletFromAddresses,
  IdentityType,
  PrivateKey,
  Wallet,
} from 'tdex-sdk';
import { ECPair, Transaction, TxOutput } from 'liquidjs-lib';
import { info, error, log } from '../logger';
import State from '../state';
import { toSatoshi } from '../helpers';
import { decrypt } from '../crypto';
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
  const blindingPrivKey = ECPair.fromWIF(
    wallet.blindingKey,
    (networks as any)[network.chain]
  ).privateKey!.toString('hex');

  let senderUtxos: UtxoInterface[];
  let assetToBeSent: string;
  let addressToSend: string;
  let amountToBeSent: number;
  let unsignedTx: string;

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

      return fetchUtxos(wallet.address, network.explorer);
    })
    .then((utxos: UtxoInterface[]) => {
      senderUtxos = utxos;
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

      return;
    })
    .then(() => {
      // create a tx using wallet
      const senderWallet = walletFromAddresses(
        [
          {
            confidentialAddress: wallet.address,
            blindingPrivateKey: blindingPrivKey,
          },
        ],
        network.chain
      );
      const tx = senderWallet.createTx();

      log('Creating and blinding transaction...');
      unsignedTx = senderWallet.buildTx(
        tx,
        senderUtxos,
        addressToSend,
        amountToBeSent,
        assetToBeSent,
        wallet.address
      );

      return confirm.run();
    })
    .then((keepGoing: boolean) => {
      if (!keepGoing) throw 'Canceled';

      const execute =
        wallet.keystore.type === 'encrypted'
          ? () => password.run()
          : () => Promise.resolve(wallet.keystore.value);

      return execute();
    })
    .then((passwordOrWif: string) => {
      const wif =
        wallet.keystore.type === 'encrypted'
          ? decrypt(wallet.keystore.value, passwordOrWif)
          : passwordOrWif;

      const blindWif = wallet.blindingKey;

      const identity = new PrivateKey({
        chain: network.chain,
        type: IdentityType.PrivateKey,
        value: {
          signingKeyWIF: wif,
          blindingKeyWIF: blindWif,
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
