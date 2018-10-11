const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const fs = require('fs');
const debug = require('debug')('websockets');
const connections = new Map();

const privateKey  = fs.readFileSync('./host.key', 'utf8');
const certificate = fs.readFileSync('./host.cert', 'utf8');

const credentials = {key: privateKey, cert: certificate};

const app = express();

//const server = https.createServer(credentials, app);
const server = http.createServer(app);

const types = {
  REGISTERING: 'REGISTERING',
  CREATEOFFER: 'CREATEOFFER',
  CREATEANSWER: 'CREATEANSWER',
  ICECANDIDATE: 'ICECANDIDATE',
  CLOSECONNECTION: 'CLOSECONNECTION'
};

const CLIENTS = {};

const addClientToChannel = (channel, client, ws) => {
  CLIENTS[client] = ws;

  const clients = connections.get(channel) || [];

  ws.send(JSON.stringify({
    to: client,
    from: 'server', 
    clients
  }));
  
  if (clients.indexOf(client) !== -1) {
    return;
  }
  
  connections.set(channel, [...clients, client]);
};

const sendOffer = ({from, to, description, type}) => {
  debug(`sendOffer from ${from} to ${to} with description: ${description}`);
  CLIENTS[to] && CLIENTS[to].send(JSON.stringify({
    to,
    from,
    description,
    type
  }));
};

const sendAnswer = ({from, to, description, type}) => {
  debug(`sendAnswer from ${from} to ${to} with description: ${description}`);
  CLIENTS[to] && CLIENTS[to].send(JSON.stringify({
    to,
    from,
    description,
    type
  }));
};

const sendCandidate = ({from, to, candidate, type}) => {
  debug(`sendCandidate from ${from} to ${to} with candidate: ${candidate}`);
  CLIENTS[to] && CLIENTS[to].send(JSON.stringify({
    to,
    from,
    candidate,
    type
  }));
};

const sendCloseConnection = ({from, to, type}) => {
  debug(`close connection between ${from} and ${to}`);
  CLIENTS[to] && CLIENTS[to].send(JSON.stringify({
    to,
    from,
    type
  }));
};

const dealWithMessage = (msg, ws) => {
  debug('dealWithMesage', msg);
  switch(msg.type) {
    case types.REGISTERING:
      return addClientToChannel(msg.channel, msg.userId, ws);

    case types.CREATEOFFER:
      return sendOffer(msg, ws);

    case types.CREATEANSWER:
      return sendAnswer(msg, ws);
    
    case types.ICECANDIDATE:
      return sendCandidate(msg, ws);
    
    case types.CLOSECONNECTION:
      return sendCloseConnection(msg, ws);

    default: 
      return;
  }
  
}

const socketServer = new WebSocket.Server({ server });

socketServer.on('open', function open() {
  console.log('server started');
});

socketServer.on('connection', ws => {
  ws.on('message', (message) => {
    const objMsg = JSON.parse(message);
    dealWithMessage(objMsg, ws);
  });

  ws.on('connection', (ws) => {
    ws.on('error', console.log);
  });

  ws.on('close', (code, reason) => {
    debug(`Close with ${code} with the ${reason}`);
    if (code === 1000) {
      const [userId, channel] = reason.split(',');
      const clients = connections.get(channel);
      const newClients = clients.splice(clients.indexOf(userId), 1);
      connections.set(channel, newClients);
      delete CLIENTS[userId];
    }
  });

});

socketServer.on('data', (data) => {
  console.log('data ', data);
});

server.listen(process.env.PORT || 1337, () => {
  console.log(`Server started on port ${server.address().port} :)`);
});