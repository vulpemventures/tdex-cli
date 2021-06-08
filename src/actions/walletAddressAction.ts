import { error, info, success } from '../logger';
import State, { KeyStoreType } from '../state';

//eslint-disable-next-line
const enquirer = require('enquirer');

const state = new State();

const password = new enquirer.Password({
  type: 'password',
  name: 'password',
  message: 'Type your password',
});

// wallet: generate a new address
export default async function (): Promise<void> {
  info('=========*** Wallet ***==========\n');
  try {
    const { wallet } = state.get();
    if (!wallet) throw new Error('wallet state is undefined');

    if (!wallet.selected)
      return error('Wallet not initialized: try "wallet init".');

    let pwd = undefined;
    if (wallet.keystore.type === KeyStoreType.Encrypted) {
      pwd = await password.run();
    }

    const identity = state.getMnemonicIdentityFromState(pwd);
    await identity.isRestored;

    const newAddressAndBlindPrivKey = await identity.getNextAddress();

    // save the new address in cache
    state.set({
      wallet: {
        ...wallet,
        addressesWithBlindingKey: [
          ...wallet.addressesWithBlindingKey,
          newAddressAndBlindPrivKey,
        ],
      },
    });

    return success(
      `new address: ${newAddressAndBlindPrivKey.confidentialAddress}`
    );
  } catch (err) {
    error(err);
    throw err;
  }
}
