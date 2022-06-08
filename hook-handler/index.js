const http = require('http');
const express = require("express");
const bodyParser = require("body-parser")
const WebSocket = require('ws');

const app = express();

app.use(bodyParser.json())

const URL = "wss://a6hviy7i3c.execute-api.us-west-1.amazonaws.com/v1?token=testToken";

let socket = {};

// websocket callbacks
const onSocketOpen = () => {
  console.log("socket connected");
}

const onSocketClose = () => {
  console.log("socket is closed");
}

const onSocketMessage = (data) => {
  console.log(data);
}

const onDisconnect = () => {
    if (socket.current?.readyState == WebSocket.OPEN) {
        socket.current.close();
    }
}


const onConnect = () => {
    if(socket.current?.readyState !== WebSocket.OPEN) {
      socket.current = new WebSocket(URL);

      // event listeners
      socket.current.addEventListener("open", onSocketOpen);
      socket.current.addEventListener("close", onSocketClose);
      socket.current.addEventListener("message", (event) => {
        onSocketMessage(event.data);
      });
    }
    console.log("connected to websocket");
}

// End point to recieve user joined meeting hooks
app.post("/userJoinedMeeting", (req, res) => {
    // connect to the websocket
    onConnect();

    console.log("from zoom joined: " + JSON.stringify(req.body.payload));

    socket.current?.send(JSON.stringify({ action: "userJoinedMeeting", body: req.body.payload }));

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end();
});

// End point to recieve user left meeting hooks
app.post("/userLeftMeeting", (req, res) => {
    // connect to the websocket
    onConnect();

    console.log("from zoom left: " + JSON.stringify(req.body.payload));

    socket.current?.send(JSON.stringify({ action: "userLeftMeeting", body: req.body.payload }));

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end();
});

// End point to recieve meeting created hooks
app.post("/meetingCreated", (req, res) => {
    // connect to the websocket
    onConnect();

    console.log("from zoom created meeting: " + JSON.stringify(req.body.payload));
    
    socket.current?.send(JSON.stringify({ action: "meetingCreated", body: req.body.payload }));

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end();
});

// End point to receive meeting started hooks
app.post("/meetingStarted", (req, res) => {
    // connect to the websocket
    onConnect();

    console.log("from zoom started meeting: " + JSON.stringify(req.body.payload));
    
    socket.current?.send(JSON.stringify({ action: "meetingStarted", body: req.body.payload }));

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end();
});

// End point to recieven meeting ended hooks
app.post("/meetingEnded", (req, res) => {
    // connect to the websocket
    onConnect();

    console.log("from zoom ended meeting: " + JSON.stringify(req.body.payload));
    
    socket.current?.send(JSON.stringify({ action: "meetingEnded", body: req.body.payload }));

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).end();
});

app.get('/', (req, res) => {
    res
      .status(200)
      .send('server is running')
      .end();
  });

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
