import {Server, Socket} from "socket.io";
import {Player, Room, rooms, WordChoice, WordData} from "@daos/rooms";
import {randomChoice} from "../util/functions";
import db from "@daos/db";
import levenshtein from "js-levenshtein";
import logger from "../util/Logger";

export default function websockets(socket: Socket, io: Server) {
    let room: Room
    let player: Player

    function broadcast(event: string) {
        socket.on(event, data => {
            if (room !== undefined && room.drawer !== undefined
                && socket.id === room.drawer.id) {
                socket.broadcast.in(room.name).emit(event, data);
            }
        })
    }

    function needsRoom(cb: (...args: any[]) => void) {
        return function (...args: any[]) {
            if (room === undefined) {
                socket.disconnect()
            }
            else {
                cb(...args)
            }
        }
    }

    function addPoints(guessed: Player) {
        guessed.points += Math.max(100 - room.guessed.length * 10, 10)
        room.drawer.points += room.guessed.length === 0 ? 100 : 10
    }

    broadcast("mouse_down");
    broadcast("mouse_move");
    broadcast("move_up");
    broadcast("colour");
    broadcast("brush_size");
    broadcast("fill");
    broadcast("clear_canvas");

    socket.on("join", (roomName: string, nick: string) => {
        const r = rooms[roomName]
        if (r !== undefined) {
            room = r
            player = {id: socket.id, name: nick, points: 0}
            room.players.push(player)
            socket.join(roomName)
            socket.emit("players", room.players, room.word !== null, room.maxTime, room.time)
            socket.to(room.name).emit("join", player)
            if (room.word === undefined && room.players.length === 2) {
                newRound()
            }
        }
        else {
            socket.disconnect()
        }
    })

    function newRound() {
        if (room.word !== undefined) {
            io.in(room.name).emit("round_end", room.word.word);
        }
        room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
        io.in(room.name).emit("round_start", room.drawer.id, room.maxTime)
        if (room.timeInt !== undefined)
            clearInterval(room.timeInt)
        room.timeInt = undefined
        room.word = undefined;
        const word1 = randomChoice(room.words);
        const word2 = randomChoice(room.words);
        const word3 = randomChoice(room.words);
        db.multi(`SELECT '${word1.category}' AS category, * FROM ${word1.category} WHERE id = $1;
                  SELECT '${word2.category}' AS category, * FROM ${word2.category} WHERE id = $2;
                  SELECT '${word3.category}' AS category, * FROM ${word3.category} WHERE id = $3;`,
            [word1.id, word2.id, word3.id]).then(result => {
            io.to(room.drawer.id)
                .emit("choose", result.map((x: WordData[]) => x[0]));
        }).catch((err) => { logger.err(err) });
    }

    socket.on("choice", needsRoom((word: WordChoice) => {
        db.one(`SELECT * FROM ${word.category} WHERE id = $1;`, word.id).then(result => {
            result.category = word.category;
            switch (result.category) {
                case "items":
                case "champions":
                    result.subtext = "";
                    break;
                case "spells":
                    result.subtext = result.champion + " " + result.key;
                    break;
                case "skins":
                    result.subtext = result.champion + " skin";
                    break;
            }
            room.guessed = [];
            room.word = result;
            room.time = room.maxTime;
            io.in(room.name).emit("time", room.time)
            if (room.timeInt === undefined) {
                room.timeInt = setInterval(() => {
                    if (room.time <= 0) return;
                    room.time -= 1;
                    io.in(room.name).emit("time", room.time)
                    if (room.time === 0) {
                        needsRoom(newRound)();
                    }
                }, 1000);
            }
            io.in(room.name).emit("round", {
                category: room.word!.category,
                word: room.word!.word.replace(/\w/g, "_ ").trimEnd()
            });
            io.to(room.drawer.id).emit("drawer", room.word);
            // eslint-disable-next-line no-console
        }).catch((err) => { logger.err(err) });
    }));

    socket.on("chat_message", needsRoom((message: string) => {
        if (room.guessed.includes(player.id)
            || player.id === room.drawer.id && room.players.length > 1) {
            return;
        }
        const msg = message.toLowerCase();
        const word = room.word?.word.toLowerCase();
        if (msg === word) {
            addPoints(player);
            room.guessed.push(player.id);
            io.in(room.name).emit("guessed", player.name);
            io.in(room.name).emit("players", room.players);

            if (room.guessed.length === room.players.length - 1) {
                newRound();
            }
            return
        }
        else if (word !== undefined) {
            if (levenshtein(msg, word) <= 1) {
                socket.emit("chat_message", player.name, message);
                io.to(room.drawer.id).emit("chat_message", player.name, message);
                socket.emit("close", message);
                return
            }
            else {
                const cleanedWord = word.replace(/[^\w\s]|_/g, "").split(" ")
                const intersection = msg.split(" ")
                    .filter(x => cleanedWord.includes(x.replace(/[^\w\s]|_/g, "")));
                if (intersection !== null && intersection.length > 0) {
                    socket.emit("chat_message", player.name, message);
                    io.to(room.drawer.id).emit("chat_message", player.name, message);
                    socket.emit("contains", room.word!.word.split(" ").filter(x =>
                        intersection.includes(x.replace(/[^\w\s]|_/g, "").toLowerCase())));
                    return
                }
            }
        }
        io.in(room.name).emit("chat_message", player.name, message);
    }));

    socket.on("disconnect", () => {
        logger.info("disconnect")
        if (room !== undefined) {
            const index = room.players.findIndex(player => player.id === socket.id);
            room.players.splice(index, 1);
            io.in(room.name).emit("leave", socket.id);
            if (index >= room.drawerIndex) {
                room.drawerIndex -= 1;
                if (index === room.drawerIndex + 1) {
                    switch (room.players.length) {
                        case 0:
                            delete rooms[room.name]
                            break
                        case 1:
                            if (room.word)
                                io.in(room.name).emit("round_end", room.word.word);
                            if (room.timeInt !== undefined)
                                clearInterval(room.timeInt)
                            room.word = undefined;
                            break
                        default:
                               newRound();
                            break
                    }
                }
            }
            if (room.guessed.length === room.players.length - 1 && room.players.length >= 2) {
                newRound()
            }
        }
    });
}