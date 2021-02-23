import {
  networks,
  UtxoInterface,
  walletFromCoins,
  RecipientInterface,
  greedyCoinSelector,
  psetToUnsignedTx,
  fetchAndUnblindUtxos,
} from 'ldk';
import { address, Psbt } from 'liquidjs-lib';
import { info, error, log } from '../logger';
import State, { KeyStoreType } from '../state';
import { toSatoshi, broadcastTx } from '../helpers';
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
      return fetchAndUnblindUtxos(
        wallet.addressesWithBlindingKey,
        network.explorer
      );
    })
    .then((utxos: UtxoInterface[]) => {
      senderUtxos = utxos.filter((u) => u.prevout);
      log('You will send ' + amountToBeSent + ' sats to ' + addressToSend);
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
    .then(async (password?: string) => {
      const identity = state.getMnemonicIdentityFromState(password);
      await identity.isRestored;
      // create a tx using wallet
      const senderWallet = walletFromCoins(
        senderUtxos,
        (networks as any)[network.chain]
      );
      const tx = senderWallet.createTx();
      const recipient: RecipientInterface = {
        value: amountToBeSent,
        address: addressToSend,
        asset: assetToBeSent,
      };

      log('Creating and blinding transaction...');
      const unsignedTx = senderWallet.buildTx(
        tx,
        [recipient],
        greedyCoinSelector(),
        (_: string) => identity.getNextChangeAddress().confidentialAddress,
        true
      );

      const addrs = identity.getAddresses();

      // cache the newly created address
      state.set({
        wallet: {
          addressesWithBlindingKey: addrs,
        },
      });

      const { blindingKey } = address.fromConfidential(addressToSend);
      const recipientScript = address.toOutputScript(addressToSend);
      const outputsToBlind: number[] = [];
      const outputsPubKey = new Map<number, string>();

      let i = 0;
      for (const out of psetToUnsignedTx(unsignedTx).outs) {
        if (out.script.length > 0) outputsToBlind.push(i);
        if (out.script.equals(recipientScript))
          outputsPubKey.set(i, blindingKey.toString('hex'));
        i++;
      }

      return identity
        .blindPset(unsignedTx, outputsToBlind, outputsPubKey)
        .then((blinded) => identity.signPset(blinded));
    })
    .then((signedTx: string) => {
      // Get the tx in hex format ready to be broadcasted
      const hex = Psbt.fromBase64(signedTx)
        .finalizeAllInputs()
        .extractTransaction()
        .toHex();

      log('broadcasting tx...');
      return broadcastTx(hex, network.explorer);
    })
    .then((txID: string) => {
      info('Transaction broadcasted. TxID = ' + txID);
    })
    .catch(error);
}
