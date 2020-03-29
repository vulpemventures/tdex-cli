import { info, log, error, success } from '../logger';
import State from '../state';
import { WalletInterface, fromWIF, fetchUtxos } from '../wallet';
import { decrypt } from '../crypto';
import { makeid } from '../helpers';
const state = new State();

const { Confirm, Password } = require('enquirer');

const confirm = new Confirm({
  name: 'question',
  message: 'Do you accept the proposed terms?'
});
const password = new Password({
  type: 'password',
  name: 'key',
  message: 'Type your password'
});


export default function (message: string): void {
  info('=========*** Swap ***==========\n');

  const { wallet, network } = state.get();

  if (!wallet.selected)
    return error('A wallet is required. Create or restoste with wallet command');

  let json: any
  try {
    json = JSON.parse(message);
  } catch (ignore) {
    return error('Not a valid SwapRequest message');
  }

  log(JSON.stringify(json, undefined, 2));
  log();

  const psbtBase64 = json.transaction;


  let walletInstance: WalletInterface;

  confirm.run().then((keepGoing: Boolean) => {
    if (!keepGoing)
      throw "Canceled";

    const execute = wallet.keystore.type === "encrypted" ?
      () => password.run() :
      () => Promise.resolve(wallet.keystore.value);

    return execute()
  }).then((passwordOrWif: string) => {
    const wif = wallet.keystore.type === "encrypted" ?
      decrypt(wallet.keystore.value, passwordOrWif) :
      passwordOrWif;

    walletInstance = fromWIF(wif, network.chain);

    return fetchUtxos(walletInstance.address, network.explorer)
  }).then((utxos: Array<any>) => {
    // Add inputs and putputs to psbt 

    const unsignedPsbt = walletInstance.updateTx(
      psbtBase64,
      utxos,
      json.amount_r,
      json.amount_p,
      json.asset_r,
      json.asset_p
    );

    log("\nSigning with private key...");
    return walletInstance.sign(unsignedPsbt);
  }).then((signedPsbt: string) => {
    success("\n√ Done\n");

    const TradeReply = {
      SwapAccept: {
        id: makeid(8),
        request_id: json.id,
        transaction: signedPsbt
      }
    };

    success(`\nSwapAccept message\n\n${JSON.stringify(TradeReply.SwapAccept)}`);
  }).catch(error)
}