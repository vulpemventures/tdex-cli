import { info, log, error, success } from '../logger';

import { ECPair } from 'liquidjs-lib';
import { networks, IdentityType, PrivateKey, IdentityOpts } from 'tdex-sdk';
import { encrypt } from '../crypto';
//eslint-disable-next-line
const enquirer = require('enquirer');

import State from '../state';
const state = new State();

function setWalletState(
  identityOpts: IdentityOpts,
  storageType: string,
  signKey: string,
  blindKey: string
): void {
  const identity = new PrivateKey(identityOpts);
  const address = identity.getNextAddress().confidentialAddress;
  state.set({
    wallet: {
      selected: true,
      address,
      blindingKey: blindKey, //blinding private key
      keystore: {
        type: storageType,
        value: {
          signingKey: signKey,
          blindingKey: blindKey,
        },
      },
    },
  });
  log();
  success(`Wallet has been created/restored successfully`);
  log();
  log(`Be sure to backup your data directory before sending any funds`);
  log(`Wallet address: ${address}`);
}

export default function (): void {
  info('=========*** Wallet ***==========\n');

  const { network, wallet } = state.get();

  if (!network.selected) return error('Select a valid network');

  if (wallet.selected) return log(`Address ${wallet.address}`);

  const restore = new enquirer.Toggle({
    message: 'Want to restore from WIF (Wallet Import Format)?',
    enabled: 'Yep',
    disabled: 'Nope',
  });

  const type = new enquirer.Select({
    type: 'select',
    name: 'type',
    message:
      'A new wallet will be created. How do you want to store your private key? 🔑',
    choices: [
      { name: 'encrypted', message: 'Encrypted (AES-128-CBC)' },
      { name: 'plain', message: 'Plain Text (not recommended)' },
    ],
  });

  const password = new enquirer.Password({
    type: 'password',
    name: 'password',
    message: 'Type your password',
  });

  const privatekey = new enquirer.Password({
    type: 'password',
    name: 'key',
    message: 'Type your private key WIF (Wallet Import Format)',
  });

  const blindingkey = new enquirer.Password({
    type: 'password',
    name: 'key',
    message: 'Type your BLINDING private key WIF (Wallet Import Format)',
  });

  restore.run().then((restoreFromWif: boolean) => {
    if (!restoreFromWif) {
      const signingKeyWIF = ECPair.makeRandom({
        network: (networks as any)[network.chain],
      }).toWIF();
      const blindingKeyWIF = ECPair.makeRandom({
        network: (networks as any)[network.chain],
      }).toWIF();

      const identity = {
        chain: network.chain,
        type: IdentityType.PrivateKey,
        value: {
          signingKeyWIF,
          blindingKeyWIF,
        },
      };

      type.run().then((storageType: string) => {
        if (storageType === 'encrypted')
          password
            .run()
            .then((password: string) => {
              setWalletState(
                identity,
                storageType,
                encrypt(signingKeyWIF, password),
                encrypt(blindingKeyWIF, password)
              );
            })
            .catch(error);
        else
          setWalletState(identity, storageType, signingKeyWIF, blindingKeyWIF);
      });
    } else {
      privatekey.run().then((signWif: string) => {
        const restoredIdentity = {
          chain: network.chain,
          type: IdentityType.PrivateKey,
          value: {
            signingKeyWIF: signWif,
            blindingKeyWIF: '',
          },
        };

        blindingkey.run().then((blindWif: string) => {
          restoredIdentity.value.blindingKeyWIF = blindWif;
          type.run().then((storageType: string) => {
            if (storageType === 'encrypted')
              password
                .run()
                .then((password: string) => {
                  setWalletState(
                    restoredIdentity,
                    storageType,
                    encrypt(signWif, password),
                    encrypt(blindWif, password)
                  );
                })
                .catch(error);
            else
              setWalletState(restoredIdentity, storageType, signWif, blindWif);
          });
        });
      });
    }
  });
}
