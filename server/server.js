const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

let lobbies = {}; // lobbyId -> { cookies, objects, upgrades, prestige, players, clients }

wss.on('connection', (ws) => {
    ws.on('message', (msg) => {
        let data;
        try { data = JSON.parse(msg); } catch { return; }

        // join lobby
        if (data.type === 'join') {
            if (!lobbies[data.lobby]) {
                lobbies[data.lobby] = {
                    cookies: 0,
                    objects: {},
                    upgrades: {},
                    prestige: 0,
                    players: {},
                    clients: []
                };
            }

            ws.lobby = data.lobby;
            ws.playerId = data.playerId || Math.random().toString(36).substr(2,9);

            lobbies[data.lobby].clients.push(ws);

            // initialize player in lobby
            if(!lobbies[data.lobby].players[ws.playerId]) {
                lobbies[data.lobby].players[ws.playerId] = { cookies: 0 };
            }

            // send full lobby state to new client
            ws.send(JSON.stringify({
                type: 'state',
                state: {
                    cookies: lobbies[data.lobby].cookies,
                    objects: lobbies[data.lobby].objects,
                    upgrades: lobbies[data.lobby].upgrades,
                    prestige: lobbies[data.lobby].prestige
                },
                players: lobbies[data.lobby].players
            }));
        }

        // handle client actions
        if (data.type === 'action') {
            const lobby = lobbies[ws.lobby];
            if (!lobby) return;

            // initialize player if missing
            if(!lobby.players[ws.playerId]) lobby.players[ws.playerId] = { cookies: 0 };

            // clicks
            if (data.action === 'click') {
                lobby.cookies += data.amount || 1;
                lobby.players[ws.playerId].cookies += data.amount || 1;
            }

            // building purchases
            if (data.action === 'buy') {
                const item = data.item;
                const amt = data.amount || 1;
                lobby.objects[item] = (lobby.objects[item] || 0) + amt;
                lobby.players[ws.playerId].cookies -= amt * (Game.Objects[item]?.basePrice || 0); // optional tracking
            }

            // upgrades
            if (data.action === 'upgrade') {
                const upg = data.item;
                lobby.upgrades[upg] = true;
            }

            // prestige
            if (data.action === 'prestige') {
                lobby.prestige = Math.max(lobby.prestige, data.amount || 0);
            }

            // broadcast updated state
            broadcastState(ws.lobby);
        }
    });

    ws.on('close', () => {
        const lobby = lobbies[ws.lobby];
        if (lobby) lobby.clients = lobby.clients.filter(c => c !== ws);
    });
});

function broadcastState(lobbyId) {
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    const payload = JSON.stringify({
        type: 'state',
        state: {
            cookies: lobby.cookies,
            objects: lobby.objects,
            upgrades: lobby.upgrades,
            prestige: lobby.prestige
        },
        players: lobby.players
    });

    lobby.clients.forEach(c => {
        if(c.readyState === 1) c.send(payload);
    });
}

console.log('Multiplayer Cookie Clicker server running on ws://localhost:8080');
