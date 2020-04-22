import { red, blue, greenBright } from 'chalk';

export const log = console.log;
export const error = (msg: string) => log(red(msg));
export const info = (msg: string) => log(blue(msg));
export const success = (msg: string) => log(greenBright(msg));
