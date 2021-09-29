export const rooms = {} as Record<string, Room | undefined>

export interface WordData {
    id: string,
    word: string,
    image: string,
    category: string,
    subtext: string
}

export interface WordChoice {
    id: string,
    category: string
}

export class Room {
    players = [] as Player[];
    guessed = [] as string[];
    drawerIndex = 0;
    word ?: WordData = undefined;
    paused = false;
    time = 0
    timeInt ?: NodeJS.Timeout = undefined;

    constructor(
        readonly name: string,
        readonly password: string,
        readonly words: Array<WordChoice>,
        readonly maxTime: number) {
    }

    get drawer(): Player {
        return this.players[this.drawerIndex]
    }
}

export interface Player {
    id: string
    name: string
    points: number
}

