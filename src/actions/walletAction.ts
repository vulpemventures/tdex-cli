import { log, error, success, info } from '../logger';
import * as bip39 from 'bip39';
import {
  EsploraIdentityRestorer,
  IdentityOpts,
  IdentityType,
  Mnemonic,
} from 'tdex-sdk';
import { encrypt } from '../crypto';
//eslint-disable-next-line

import State, {
  KeyStoreType,
  StateWalletInterface,
  stringToKeyStoreType,
} from '../state';
import { getWalletInfo } from '../helpers';

//eslint-disable-next-line
const enquirer = require('enquirer');

// global variables
const state = new State();

const password = new enquirer.Password({
  type: 'password',
  name: 'password',
  message: 'Type your password',
});

async function setWalletState(
  identityOpts: IdentityOpts,
  storageType: KeyStoreType,
  seed: string
) {
  try {
    const identity = new Mnemonic(identityOpts);
    if (identityOpts.initializeFromRestorer) {
      log('Restore the wallet...');
      await identity.isRestored;
    }

    const wallet: StateWalletInterface = {
      selected: true,
      addressesWithBlindingKey: identity.getAddresses(),
      keystore: {
        type: storageType,
        value: seed,
      },
    };

    state.set({ wallet });

    log();
    success(`Wallet has been created/restored successfully`);
    log();
    log(`Be sure to backup your data directory before sending any funds`);
    log(getWalletInfo(state.get().wallet.addressesWithBlindingKey));
  } catch (err) {
    error(err);
  }
}

// command function
export default async function () {
  info('=========*** Wallet ***==========\n');
  try {
    const { network, wallet } = state.get();

    if (!network.selected) return error('Select a valid network');

    // if wallet is already configured, log the state.
    if (wallet.selected) {
      success('Wallet is initialized.');
      return log(getWalletInfo(wallet.addressesWithBlindingKey));
    }

    const restore = new enquirer.Toggle({
      message: 'Want to restore from mnemonic seed?',
      enabled: 'Yep',
      disabled: 'Nope',
    });

    const keystoreType = new enquirer.Select({
      type: 'select',
      name: 'type',
      message:
        'A new wallet will be created. How do you want to store your seed? 🔑',
      choices: [
        { name: 'Encrypted', message: 'Encrypted (AES-128-CBC)' },
        { name: 'Plain', message: 'Plain Text (not recommended)' },
      ],
    });

    // ask if restored wallet
    const restoreFromSeed = await restore.run();
    // ask the type of encryption
    const type = await keystoreType.run();
    const storageType = stringToKeyStoreType(type);

    // if not restore is choosen --> generate new seed
    if (!restoreFromSeed) {
      const randomSeed = bip39.generateMnemonic();

      const identity = {
        chain: network.chain,
        type: IdentityType.Mnemonic,
        value: {
          mnemonic: randomSeed,
        },
      };

      log('Write down on paper these words to backup your wallet\n');
      info(randomSeed);
      log();

      if (storageType === KeyStoreType.Encrypted) {
        const pswd: string = await password.run();
        await setWalletState(identity, storageType, encrypt(randomSeed, pswd));
        return;
      }

      await setWalletState(identity, storageType, randomSeed);
      return;
    }

    // restore from mnemonic
    const restoredIdentity: IdentityOpts = {
      chain: network.chain,
      type: IdentityType.Mnemonic,
      value: {
        mnemonic: '',
      },
      initializeFromRestorer: true,
      restorer: new EsploraIdentityRestorer(network.explorer),
    };

    const { mnemonic } = await enquirer.prompt({
      type: 'input',
      name: 'mnemonic',
      message: 'Type your mnemonic sentence (never share it!)',
    });

    restoredIdentity.value.mnemonic = mnemonic;

    if (storageType === KeyStoreType.Encrypted) {
      const pwsd = await password.run();
      await setWalletState(
        restoredIdentity,
        storageType,
        encrypt(mnemonic, pwsd)
      );
      return;
    }

    await setWalletState(restoredIdentity, storageType, mnemonic);
    return;
  } catch (err) {
    error(err);
    throw err;
  }
}
