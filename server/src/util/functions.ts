import logger from './Logger';

export function randomChoice<T>(list: Array<T>): T {
    return list[Math.floor(Math.random() * list.length)];
}
