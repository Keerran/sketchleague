import './pre-start'; // Must be the first import
import app from '@server';
import logger from './util/Logger';
import {createServer} from "http";
import {Server} from 'socket.io';
import websockets from "./routes/websockets";

const http = createServer(app)
const io = new Server(http, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.use((socket, next) => {
    console.log(socket.request)
    next()
})

io.on("connection", socket => {
    websockets(socket, io)
})

// Start the server
const port = Number(process.env.PORT || 3000);
http.listen(port, () => {
    logger.info('Express server started on port: ' + port);
});
