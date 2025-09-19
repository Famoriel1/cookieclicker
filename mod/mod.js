// Multiplayer Cookie Clicker Mod (merge-style sync, leaderboard)
// Uses CCSE framework
if(typeof CCSE === 'undefined') Game.LoadMod('https://klattmose.github.io/CookieClicker/CCSE.js');

var MP = {};
MP.version = '0.3';
MP.sharedState = { cookies:0, objects:{}, upgrades:{}, prestige:0 };
MP.lobby = null;
MP.ws = null;
MP.playerId = Math.random().toString(36).substr(2,9);
MP.leaderboard = {};

MP.launch = function(){
    // add custom menu
    Game.customMenu.push(MP.createMenu);

    // prompt for lobby
    MP.lobby = prompt("Enter Lobby ID:");

    // connect to WebSocket server
    MP.connect();

    // patch clicks, buys, upgrades
    MP.patchClicksBuysUpgrades();
};

if(!MP.isLoaded){
    if(CCSE && CCSE.isLoaded){
        MP.launch();
        MP.isLoaded = true;
    } else {
        if(!CCSE.postLoadHooks) CCSE.postLoadHooks = [];
        CCSE.postLoadHooks.push(MP.launch);
    }
}

// menu for multiplayer info
MP.createMenu = function(){
    var html = `<div>
        <h3>Lobby: ${MP.lobby || 'none'}</h3>
        <div id="mp-shared-state">Cookies: ${MP.sharedState.cookies}</div>
    </div>`;
    CCSE.AppendCollapsibleOptionsMenu('Multiplayer', html);
};

// WebSocket connection
MP.connect = function(){
    MP.ws = new WebSocket("ws://localhost:8080"); // change to your server URL

    MP.ws.onopen = function(){
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
};

// apply server state locally
MP.applyState = function(){
    Game.cookies = MP.sharedState.cookies;

    for(var name in MP.sharedState.objects)
        if(Game.Objects[name]) Game.Objects[name].amount = MP.sharedState.objects[name];

    for(var upg in MP.sharedState.upgrades)
        if(Game.Upgrades[upg] && MP.sharedState.upgrades[upg] && !Game.Upgrades[upg].bought)
            Game.Upgrades[upg].buy();

    Game.prestige = MP.sharedState.prestige;

    // leaderboard panel
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

// patch clicks, buys, upgrades to broadcast actions
MP.patchClicksBuysUpgrades = function(){
    // clicks
    var origClick = Game.ClickCookie;
    Game.ClickCookie = function(e,a){
        a = a||1;
        if(MP.ws && MP.ws.readyState===1)
            MP.ws.send(JSON.stringify({ type:'action', action:'click', amount:a, playerId: MP.playerId }));
        Game.cookies += a; // local smoothness
        return origClick.call(this,e,a);
    };

    // building purchases
    var origBuy = Game.Object.prototype.buy;
    Game.Object.prototype.buy = function(a){
        a = a||1;
        if(MP.ws && MP.ws.readyState===1)
            MP.ws.send(JSON.stringify({ type:'action', action:'buy', item:this.name, amount:a, playerId: MP.playerId }));
        return origBuy.call(this,a);
    };

    // upgrades
    Game.UpgradesById.forEach(function(upg){
        var origUpgBuy = upg.buy;
        upg.buy = function(){
            if(MP.ws && MP.ws.readyState===1)
                MP.ws.send(JSON.stringify({ type:'action', action:'upgrade', item:upg.name, playerId: MP.playerId }));
            return origUpgBuy.call(this);
        };
    });
};
