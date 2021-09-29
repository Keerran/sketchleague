import React, {
    Component,
    createRef,
    KeyboardEvent,
    MouseEvent,
    RefObject,
    useRef,
    useState
} from "react"
import {io, Socket} from "socket.io-client";
import "./style.css"
import {capitalise, hexToRgb} from "./util";

interface RoomProps {
    match: {
        params: {
            room: string
        }
    }
}

interface Mouse {
    x: number,
    y: number
}

interface Hint {
    category: string,
    word: string
}

interface RoomState {
    drawing: boolean,
    mouse: Mouse,
    drawer?: string,
    brushSize: number,
    chat: JSX.Element[],
    message: string
    time: number,
    word?: WordData,
    choices?: [WordChoice, WordChoice, WordChoice],
    players: Player[],
    hint?: Hint
}

interface WordData {
    word: string,
    image: string
    category: string,
    subtext: string
}

interface Player {
    id: string,
    name: string,
    points: number
}

interface WordChoice {
    id: string,
    word: string,
    category: string
}

class Room extends Component<RoomProps, RoomState> {
    private readonly canvas: RefObject<HTMLCanvasElement>;
    private readonly room: string;
    private colours: string[];
    private brush: Brush
    // @ts-ignore
    private readonly socket = io({
        secure: true,
        "sync disconnect on unload": true
    });
    private nick: string | null = null;

    get ctx(): CanvasRenderingContext2D {
        return this.canvas.current!.getContext("2d")!;
    }

    get isDrawer(): boolean {
        return this.state.drawer === this.socket.id
    }

    constructor(props: RoomProps) {
        super(props)
        this.state = {
            drawing: false,
            mouse: {x: 0, y: 0},
            brushSize: 10,
            chat: [],
            message: "",
            time: 0,
            players: []
        }
        this.canvas = createRef()
        this.brush = new Brush(this.canvas)
        this.room = props.match.params.room

        this.colours = ["A90F00", "FF1800", "ED7000", "FFA400", "FFF000", "A0EB39", "006B00", "AAD4E9", "2074DD", "000EFF", "E721DF", "75106F", "FFE1AC", "63400C", "412D07", "979697", "686769", "464446", "010001", "ffffff"]
            .map(colour => "#" + colour)
    }

    componentDidMount() {
        const socket = this.socket
        this.nick = null;
        while ((this.nick = prompt("Nickname")) === null) {
        }

        socket.emit("join", this.room, this.nick);
        this.addMessage(`${this.nick} has joined the room.`, "reveal")
        const rect = this.canvas.current!.getBoundingClientRect();
        this.ctx.canvas.width = rect.width;
        this.ctx.canvas.height = rect.height;
        this.ctx.imageSmoothingEnabled = false
        this.ctx.fillStyle = "#ffffff"
        this.clearCanvas()
        this.ctx.lineWidth = 10;
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";
        this.changeColour("#010001");

        document.addEventListener("mouseup", () => {
            if (this.state.drawing) {
                this.ctx.closePath()
                this.setState({drawing: false})
                this.socket.emit("mouse_up", this.state.mouse)
            }
        })

        socket.on("brush_size", (size: number) => this.ctx.lineWidth = size)

        socket.on("mouse_down", (mouse: Mouse) => {
            this.ctx.beginPath();
            this.ctx.moveTo(mouse.x + 0.5, mouse.y + 0.5);
            this.ctx.lineTo(mouse.x + 0.5, mouse.y + 0.5);
            this.ctx.stroke();
        });

        socket.on("mouse_move", (mouse: Mouse) => {
            this.ctx.lineTo(mouse.x + 0.5, mouse.y + 0.5);
            this.ctx.stroke();
        });

        socket.on("mouse_up", (mouse: Mouse) => {
            this.ctx.closePath();
            this.ctx.moveTo(mouse.x + 0.5, mouse.y + 0.5);
        });

        socket.on("clear_canvas", this.clearCanvas.bind(this));

        socket.on("colour", this.changeColour.bind(this));

        socket.on("fill", (mouse: Mouse) => this.floodFill(mouse.x, mouse.y))

        socket.on("guessed", (player: string) => {
            this.addMessage(`${player} guessed the word!`, "guessed");
        });

        socket.on("close", (msg: string) => {
            this.addMessage(`"${msg}" is 1 letter off!`)
        })

        socket.on("contains", (intersection: string[]) => {
            this.addMessage(`You have found the following words: ${intersection.join(",")}`, "close");
        })

        socket.on("chat_message", this.addUserMessage.bind(this))

        socket.on("round_start", (drawer: string, time: number) => this.setState({drawer, time}))

        socket.on("round", (hint: Hint) => {
            this.clearCanvas();
            this.setState({
                hint,
            })
        })

        socket.on("round_end", (word: string) => {
            this.setState({
                drawing: false,
                drawer: undefined,
                word: undefined,
                hint: undefined
            })
            this.addMessage(`The word was ${word}.`, "reveal")
        })
        socket.on("choose", (choices: [WordChoice, WordChoice, WordChoice]) => {
            this.setState({choices})
        })

        socket.on("drawer", (word: WordData) => {
            this.setState({
                word: word,
                choices: undefined
            })
        })

        socket.on("join", (player: Player) => {
            this.setState({
                players: [...this.state.players, player]
            })
            this.addMessage(`${player.name} has joined the room.`, "reveal")
        });

        socket.on("players", (players: Player[]) => {
            this.setState({players})
        })

        socket.on("leave", (id: string) => {
            const players = [...this.state.players]
            const index = players.findIndex(player => player.id === id)
            const player = players.splice(index, 1)[0]
            this.addMessage(`${player.name} has left the room.`, "reveal")
            this.setState({
                players: players
            })
        })

        socket.on("time", (time: number) => this.setState({time}))
    }

    addUserMessage(user: string, message: string) {
        this.addMessage(`<strong>{user}</strong>: ${message}`)
    }

    addMessage(text: string, className = "") {
        const message = <div className={`message ${className}`}>{text}</div>
        this.setState({
            chat: [message, ...this.state.chat]
        })
    }


    changeColour(colour: string) {
        if (this.isDrawer) {
            this.ctx.strokeStyle = this.ctx.fillStyle = colour;
            // this.brush.colour = hexToRgb(colour)!;
            this.brush.colour = colour
            this.brush.updateCursor()
            this.forceUpdate()
            this.socket.emit("colour", colour)
        }
    }

    handleMouseDown = () => {
        if (this.isDrawer) {
            const mouse = this.state.mouse
            if (this.brush.tool === "paint") {
                this.ctx.beginPath();
                this.ctx.moveTo(mouse.x + 0.5, mouse.y + 0.5);
                this.ctx.lineTo(mouse.x + 0.5, mouse.y + 0.5);
                this.ctx.stroke();
                this.setState({drawing: true})
                this.socket.emit("mouse_down", mouse)
            }
            else {
                this.floodFill(mouse.x, mouse.y)
                this.socket.emit("fill", mouse);
            }
        }
    }

    handleMouseMove = (event: MouseEvent) => {
        const mouse = {x: 0, y: 0}
        const rect = this.canvas.current!.getBoundingClientRect()
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        this.setState({mouse})
        if (this.state.drawing) {
            this.ctx.lineTo(mouse.x + 0.5, mouse.y + 0.5);
            this.ctx.stroke();
            this.socket.emit("mouse_move", mouse);
        }
    }

    clearCanvas = () => {
        this.ctx.fillStyle = "#fff"
        this.ctx.fillRect(0, 0, this.canvas.current!.width, this.canvas.current!.height)
        this.ctx.fillStyle = this.brush.colour
        this.socket.emit("clear_canvas")
    }

    changeTool = (tool: BrushTool) => {
        this.brush.tool = tool
        this.forceUpdate()
        this.brush.updateCursor()
    }

    formatTime(time: number): string {
        const quotient = Math.floor(time / 60)
        const remainder = (time % 60).toString().padStart(2, "0")
        return `${quotient}:${remainder}`
    }

    render = (() => {
        console.log(this.brush.colour)
        const colours = this.colours.map(colour =>
            <td key={colour} className={"colour" + (this.brush.colour === colour ? " active" : "")}
                style={{background: colour}}
                onClick={() => this.changeColour(colour)}>
            </td>
        )
        return (
            <div className="App Room">
                <div id="sidebar">
                    <Players players={this.state.players}/>
                    <Chat chat={this.state.chat} socket={this.socket}/>
                </div>
                <div id="topbar">
                    <div id="timer">
                        {this.formatTime(this.state.time)}
                    </div>
                    <div id="hint">
                        <div
                            className="category">{capitalise(this.state.hint?.category ?? "")}</div>
                        <pre className="word">{this.state.hint?.word ?? ""}</pre>
                    </div>
                    <Word word={this.state.word}/>
                </div>
                <div id="brush">
                    <table id="colours">
                        <tbody>
                        <tr>
                            {colours.slice(0, this.colours.length / 2)}
                        </tr>
                        <tr>
                            {colours.slice(this.colours.length / 2)}
                        </tr>
                        </tbody>
                    </table>
                    <div id="size">
                        <div className="inner">
                            <label htmlFor="size-input">Size</label>
                            <input id="size-input" name="size-input" type="range" min="5" max="50"
                                   value={this.state.brushSize}
                                   onChange={event => {
                                       const value = +event.target!.value
                                       this.ctx.lineWidth = value;
                                       this.setState({brushSize: value})
                                       this.socket.emit("brush_size", value)
                                   }}/>
                        </div>
                    </div>

                    <button
                        className={"tool-button icon-button" + (this.brush.tool === "paint" ? " active" : "")}
                        onClick={() => this.changeTool("paint")}
                        disabled={this.brush.tool === "paint"}>
                        <span className="material-icons">brush</span>
                    </button>

                    <button
                        className={"tool-button icon-button" + (this.brush.tool === "fill" ? " active" : "")}
                        onClick={() => this.changeTool("fill")}
                        disabled={this.brush.tool === "fill"}>
                        <span className="material-icons">format_paint</span>
                    </button>

                    <button className="icon-button" onClick={() => {
                        if (this.isDrawer) this.clearCanvas()
                    }}>
                        <span className="material-icons">delete</span>
                    </button>
                </div>
                <div id="game">
                    <canvas id="canvasGame" ref={this.canvas}
                            onContextMenu={e => e.preventDefault()}
                            onMouseDown={this.handleMouseDown}
                            onMouseMove={this.handleMouseMove}>
                        HTML Canvas isn't supported on your browser.
                    </canvas>
                    <Choices choices={this.state.choices} socket={this.socket}/>
                </div>
            </div>
        )
    })

    floodFill(startX: number, startY: number) {
        const colour = hexToRgb(this.brush.colour)!
        const colours = this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        const canvasWidth = this.canvas.current!.width;

        const startPos = (startY * canvasWidth + startX) * 4,
            startR = colours.data[startPos],
            startG = colours.data[startPos + 1],
            startB = colours.data[startPos + 2]
        if (startR === colour.r && startG === colour.g && startB === colour.b) {
            // Return because trying to fill with the same color
            return;
        }
        let newPos,
            x,
            y,
            pixelPos,
            reachLeft,
            reachRight,
            pixelStack = [[startX, startY]];
        while (pixelStack.length) {

            newPos = pixelStack.pop()!;
            x = newPos[0];
            y = newPos[1];

            // Get current pixel position
            pixelPos = (y * canvasWidth + x) * 4;

            // Go up as long as the color matches and are inside the canvas
            while (y >= 0 && this.matchStartColor(colours, pixelPos, startR, startG, startB)) {
                y -= 1;
                pixelPos -= canvasWidth * 4;
            }

            pixelPos += canvasWidth * 4;
            y += 1;
            reachLeft = false;
            reachRight = false;

            // Go down as long as the color matches and in inside the canvas
            while (y <= this.canvas.current!.height && this.matchStartColor(colours, pixelPos, startR, startG, startB)) {
                y += 1;

                this.colorPixel(colours, pixelPos, colour.r, colour.g, colour.b);
                if (x > 0) {
                    if (this.matchStartColor(colours, pixelPos - 4, startR, startG, startB)) {
                        if (!reachLeft) {
                            // Add pixel to stack
                            pixelStack.push([x - 1, y]);
                            reachLeft = true;
                        }
                    }
                    else if (reachLeft) {
                        reachLeft = false;
                    }
                }

                if (x < canvasWidth) {
                    if (this.matchStartColor(colours, pixelPos + 4, startR, startG, startB)) {
                        if (!reachRight) {
                            // Add pixel to stack
                            pixelStack.push([x + 1, y]);
                            reachRight = true;
                        }
                    }
                    else if (reachRight) {
                        reachRight = false;
                    }
                }

                pixelPos += canvasWidth * 4;
            }
        }

        this.ctx.putImageData(colours, 0, 0);
    }

    colorPixel(colours: ImageData, pixelPos: number, r: number, g: number, b: number, a?: number) {
        colours.data[pixelPos] = r;
        colours.data[pixelPos + 1] = g;
        colours.data[pixelPos + 2] = b;
        colours.data[pixelPos + 3] = a ?? 255;
    }

    matchStartColor(colours: ImageData, pixelPos: number, startR: number, startG: number, startB: number) {
        const r = colours.data[pixelPos];
        const g = colours.data[pixelPos + 1];
        const b = colours.data[pixelPos + 2];

        // If the current pixel matches the clicked color
        return r === startR && g === startG && b === startB
    }
}

function useForceUpdate() {
    const setValue = useState(false)[1];
    return () => setValue(value => !value);
}


function Players(props: { players: Player[] }) {
    return (
        <ul id="players">
            {props.players.sort((a, b) => b.points - a.points)
                .map(player =>
                    <li key={player.id} id={player.id} className="player">
                        <span className="player-icon material-icons">person</span>
                        <div className="player-name">{player.name}</div>
                        <div className="player-points">{player.points}</div>
                    </li>
                )
            }
        </ul>
    )
}


function Chat(props: { chat: JSX.Element[], socket: Socket }) {
    const [message, setMessage] = useState("")

    function messageInput(event: KeyboardEvent) {
        if (event.key === "Enter") {
            event.preventDefault()
            props.socket.emit("chat_message", message)
            setMessage("")
        }
    }

    return (
        <div id="chat">
            <div id="messages">{props.chat}</div>
            <div id="message-input">
                <div className="button">
                    <button><span className="material-icons">send</span></button>
                </div>
                <div className="input">
                    <input type="text"
                           placeholder="Make a guess"
                           value={message}
                           onChange={event => setMessage(event.target.value)}
                           onKeyPress={messageInput}
                    />
                </div>
            </div>
        </div>
    )
}


function Word({word}: {word?: WordData}) {
    const [pinned, setPinned] = useState(false)
    const [hovered, setHovered] = useState(false)
    const forceUpdate = useForceUpdate()
    const word_info = useRef<HTMLDivElement>(null)
    const height = word_info.current?.clientHeight ?? 0

    if(word === undefined) return null

    return (
        <div id="to-draw" style={{height: (hovered ? height : 0) + 100 + "px"}}
             onMouseEnter={() => {
                 setHovered(true)
             }}
             onMouseLeave={() => {
                 if (!pinned) {
                     setHovered(false)
                 }
             }}>
            <div id="word">
                <span>{word.word}</span>
            </div>
            <div id="word-info" ref={word_info}>
                <img alt={word.subtext} src={word.image} onLoad={() => forceUpdate()}/>
                <span id="category">{capitalise(word.category)}</span>
                <div id="subtext">{word.subtext}</div>
                <button id="pin" className={pinned ? "on" : ""}
                        onClick={() => setPinned(!pinned)}>
                    <span className="material-icons">push_pin</span>
                </button>
            </div>
        </div>
    )
}


function Choices(props: {choices?: WordChoice[], socket: Socket}) {
    if (props.choices === undefined) return null
    return (
        <div id="choices">
            {props.choices.map(choice =>
                <button className="choice" key={choice.id}
                        onClick={() => {
                            props.socket.emit("choice", choice)
                        }}>
                    {choice.word}
                </button>
            )}
        </div>
    )
}


type BrushTool = "paint" | "fill"

class Brush {
    canvas = document.createElement("canvas");
    ctx = this.canvas.getContext("2d")!;
    tool = "paint" as BrushTool
    colour = "#010001"

    constructor(readonly game: RefObject<HTMLCanvasElement>) {
        this.canvas.width = this.canvas.height = 40;
    }

    updateCursor() {
        switch (this.tool) {
            case "paint":
                this.ctx.fillStyle = this.colour;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(20 + 0.5, 20 + 0.5, 10, 0, 2 * Math.PI);
                this.ctx.fill();

                this.ctx.strokeStyle = "#fff";
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(20 + 0.5, 20 + 0.5, 9, 0, 2 * Math.PI);
                this.ctx.stroke();

                this.game.current!.style.cursor = `url(${this.canvas.toDataURL()}) 20 20, default`;
                break;
            case "fill":
                this.game.current!.style.cursor = 'url("/images/fill.png") 20 20, default'
        }
    }
}

export default Room