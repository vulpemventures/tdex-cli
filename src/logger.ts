import { red, blue, greenBright } from 'chalk';

export const log = console.log;
export const error: LoggerFunction = (msg: string) => log(red(msg));
export const info: LoggerFunction = (msg: string) => log(blue(msg));
export const success: LoggerFunction = (msg: string) => log(greenBright(msg));

export type LoggerFunction = (msg: string) => void;
