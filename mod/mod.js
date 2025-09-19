// Multiplayer Cookie Clicker Mod (full working version)
alert('Mod JS loaded');

if(typeof CCSE === 'undefined') {
    alert('CCSE not loaded, loading now...');
    Game.LoadMod('https://klattmose.github.io/CookieClicker/CCSE.js');
}

var MP = {};
MP.version = '0.4';
MP.sharedState = { cookies:0, objects:{}, upgrades:{}, prestige:0 };
MP.lobby = null;
MP.ws = null;
MP.playerId = Math.random().toString(36).substr(2,9);
MP.leaderboard = {};

MP.launch = function(){
    alert('Launching multiplayer mod...');
    Game.customMenu.push(MP.createMenu);
    MP.lobby = prompt("Enter Lobby ID:");
    MP.connect();
    MP.patchClicksBuysUpgrades();
};

if(CCSE && CCSE.isLoaded){
    MP.launch();
} else {
    if(!CCSE.postLoadHooks) CCSE.postLoadHooks=[];
    CCSE.postLoadHooks.push(MP.launch);
}

// Menu for multiplayer info
MP.createMenu = function(){
    var html = `<div>
        <h3>Lobby: ${MP.lobby || 'none'}</h3>
        <div id="mp-shared-state">Cookies: ${MP.sharedState.cookies}</div>
    </div>`;
    CCSE.AppendCollapsibleOptionsMenu('Multiplayer', html);
};

// Connect to WebSocket server
MP.connect = function(){
	MP.ws = new WebSocket("ws://192.168.1.228:8080");


    MP.ws.onopen = function(){
        alert('Connected to server');
        MP.ws.send(JSON.stringify({
            type:'join',
            lobby: MP.lobby,
            playerId: MP.playerId
        }));
    };

    MP.ws.onmessage = function(e){
        var data = JSON.parse(e.data);
        if(data.type === 'state'){
            MP.sharedState = data.state;
            if(data.players) MP.leaderboard = data.players;
            MP.applyState();
        }
    };

    MP.ws.onerror = function(e){
        alert('WebSocket error: '+JSON.stringify(e));
    };

    MP.ws.onclose = function(){
        alert('WebSocket connection closed');
    };
};

// Apply server state locally
MP.applyState = function(){
    Game.cookies = MP.sharedState.cookies;

    for(var name in MP.sharedState.objects)
        if(Game.Objects[name]) Game.Objects[name].amount = MP.sharedState.objects[name];

    for(var upg in MP.sharedState.upgrades)
        if(Game.Upgrades[upg] && MP.sharedState.upgrades[upg] && !Game.Upgrades[upg].bought)
            Game.Upgrades[upg].buy();

    Game.prestige = MP.sharedState.prestige;

    // Leaderboard panel
    var el = document.getElementById("mp-leaderboard");
    if(!el){
        el = document.createElement("div");
        el.id = "mp-leaderboard";
        el.style.position = "fixed";
        el.style.top = "10px";
        el.style.right = "10px";
        el.style.background = "rgba(0,0,0,0.7)";
        el.style.color = "white";
        el.style.padding = "10px";
        el.style.zIndex = 9999;
        document.body.appendChild(el);
    }

    var html = `<h4>Lobby: ${MP.lobby}</h4>`;
    for(var pid in MP.leaderboard)
        html += `${pid}: ${MP.leaderboard[pid].cookies} cookies<br>`;
    el.innerHTML = html;
};

// Patch clicks, buys, upgrades to broadcast actions
MP.patchClicksBuysUpgrades = function(){
    // Clicks
    var origClick = Game.ClickCookie;
    Game.ClickCookie = function(e,a){
        a = a||1;
        if(MP.ws && MP.ws.readyState===1)
            MP.ws.send(JSON.stringify({ type:'action', action:'click', amount:a, playerId: MP.playerId }));
        Game.cookies += a; // local smoothness
        return origClick.call(this,e,a);
    };

    // Building purchases
    var origBuy = Game.Object.prototype.buy;
    Game.Object.prototype.buy = function(a){
        a = a||1;
        if(MP.ws && MP.ws.readyState===1)
            MP.ws.send(JSON.stringify({ type:'action', action:'buy', item:this.name, amount:a, playerId: MP.playerId }));
        return origBuy.call(this,a);
    };

    // Upgrades
    Game.UpgradesById.forEach(function(upg){
        var origUpgBuy = upg.buy;
        upg.buy = function(){
            if(MP.ws && MP.ws.readyState===1)
                MP.ws.send(JSON.stringify({ type:'action', action:'upgrade', item:upg.name, playerId: MP.playerId }));
            return origUpgBuy.call(this);
        };
    });
};
