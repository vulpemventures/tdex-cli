import { info, log, error, success } from '../logger';
import * as bip39 from 'bip39';
import { IdentityType, IdentityOpts, Mnemonic } from 'tdex-sdk';
import { encrypt } from '../crypto';
//eslint-disable-next-line
const enquirer = require('enquirer');

import State, {
  getWalletInfo,
  KeyStoreType,
  StateWalletInterface,
  stringToKeyStoreType,
} from '../state';
const state = new State();

function setWalletState(
  identityOpts: IdentityOpts,
  storageType: KeyStoreType,
  seed: string
): void {
  const identity = new Mnemonic(identityOpts);
  const wallet: StateWalletInterface = {
    selected: true,
    identity,
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
  log(getWalletInfo(state.get().wallet));
}

export default function (): void {
  info('=========*** Wallet ***==========\n');

  const { network, wallet } = state.get();

  if (!network.selected) return error('Select a valid network');

  // if wallet is already configured, log the state.
  if (wallet.selected) return log(getWalletInfo(wallet));

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

  const password = new enquirer.Password({
    type: 'password',
    name: 'password',
    message: 'Type your password',
  });

  const mnemonic = new enquirer.Password({
    type: 'password',
    name: 'mnemonic',
    message: 'Type your mnemonic seed',
  });

  restore.run().then((restoreFromSeed: boolean) => {
    // if not restore is choosen --> generate new seed
    if (!restoreFromSeed) {
      const randomSeed = bip39.generateMnemonic(512);

      const identity = {
        chain: network.chain,
        type: IdentityType.Mnemonic,
        value: {
          mnemonic: randomSeed,
        },
      };

      keystoreType.run().then((type: string) => {
        const storageType = stringToKeyStoreType(type);

        if (storageType === KeyStoreType.Encrypted)
          password
            .run()
            .then((password: string) => {
              setWalletState(
                identity,
                storageType,
                encrypt(randomSeed, password)
              );
            })
            .catch(error);
        else setWalletState(identity, storageType, randomSeed);
      });
    } else {
      // restore from mnemonic
      const restoredIdentity = {
        chain: network.chain,
        type: IdentityType.Mnemonic,
        value: {
          mnemonic: '',
        },
      };

      mnemonic.run().then((mnemonic: string) => {
        restoredIdentity.value.mnemonic = mnemonic;

        keystoreType.run().then((type: string) => {
          const storageType = stringToKeyStoreType(type);

          if (storageType === KeyStoreType.Encrypted)
            password
              .run()
              .then((password: string) => {
                setWalletState(
                  restoredIdentity,
                  storageType,
                  encrypt(mnemonic, password)
                );
              })
              .catch(error);
          else setWalletState(restoredIdentity, storageType, mnemonic);
        });
      });
    }
  });
}
