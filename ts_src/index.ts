#!/usr/bin/env node

//  0. Load from WIF/Create keyPair
//  1. Select an endpoint and connect to the daemon
//  2. Select asset pair and Fetch his market rate 
//  3. Start swap proposal 
//  4. Parsing acceptance from the daemon & sign
//  5. Sending signed swap back to daemon. 
import { program } from 'commander'
import Wallet, { fromWIF } from './wallet';

const pkg = require('../package.json');
//const w = fromWIF("cNiZ5A2UgR11Kw79QsgqeziPJLXVnftGVBmeHZag53RcvDod5SsW", "regtest");
//console.log(w.address)

program
  .version(pkg.version)

program
  .command('connect <endpoint>')
  .description('Select a defualt liquidty provider')
  .action((endpoint) => {
    console.log(endpoint)
    console.log('Connect command called');
  });


program
  .command('market list')
  .description('Get available assets pairs for the selected provider')
  .action(() => {
  });

program
  .command('market <pair>')
  .description('Select a default asset pair to use for the swap')
  .action((pair) => {
    console.log(pair)
  });

program
  .command('market price')
  .description('Get current price of the selected asset pair')
  .action(() => {

  });





program.parse(process.argv);