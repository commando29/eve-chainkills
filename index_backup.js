const WebSocket = require('ws');
const { WebhookClient } = require('discord.js');
const { createLogger, format, transports } = require("winston");
var mysql      = require('mysql');

var config = require("./config.json");
let webhookId = config.discordWebhookId;
let webhookToken = config.discordWebhookToken;
let mapIds = config.mapIds;
let ignoreSystemIds = config.ignoreSystemIds;
var reconnectInterval = x * 1000 * 60;

const logLevels = config.logLevels;

const logger = createLogger({
  level: config.maxLogLevel,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()],
});

const ZKILL_SOCKET = 'wss://zkillboard.com/websocket/'
systems = [];
mapCharacterIds = [];
var lastUpdateTime = Date.now;

logger.info("Starting chain kill checker.");

updateSystems(mapIds);
getMapCharacterIds();

/**
 * Handles the actual sending request.
 * We're turning the https.request into a promise here for convenience
 * @param webhookURL
 * @param messageBody
 * @return {Promise}
 */
function sendMessageMessage (webhookId, webhookToken, messageBody) {
    const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

    webhookClient.send({
        content: messageBody,
    });
}

function updateSystems(mapIds) {
    logger.info("Updating system list.");
    systems = [];
    var connection = mysql.createConnection({
        host     : config.dbHost,
        user     : config.dbUser,
        password : config.dbPass,
        database : config.dbName,
    });

    connection.connect();

    connection.query('select systemId, alias from system where mapId in (' + mapIds + ') and active = 1 and typeId = 1', function (error, results, fields) {
    if (error) throw error;
        logger.debug(results);
        systems = results;
        logger.debug("***Results Len = " + results.length + ".");
        logger.debug("***Result[0]=" + results[0].systemId + "...");
    });
    lastUpdateTime = Date.now();
    connection.end();
}

function getMapCharacterIds() {
    logger.info("Getting characters from database.");
    mapCharacterIds = [];
    var connection = mysql.createConnection({
        host     : config.dbHost,
        user     : config.dbUser,
        password : config.dbPass,
        database : config.dbName,
    });

    connection.connect();

    connection.query('select characterId from character_map  where mapId in (' + mapIds + ') and active = 1', function (error, results, fields) {
    if (error) throw error;
        logger.debug(results);
        logger.debug("***Results Len = " + results.length + ".");
        mapCharacterIds=results;
    });

    connection.end();
    return false;
}

function updateMapDetails(systemId, statusId) {
    logger.info("Updating map details");
  
    var connection = mysql.createConnection({
        host     : config.dbHost,
        user     : config.dbUser,
        password : config.dbPass,
        database : config.dbName,
    });

    connection.connect();
    var updateSystemSQL = 'update system set statusId = ' + statusId + ' where systemID = ' + systemId + ' and mapId in (' + mapIds + ') and active = 1';
    console.log(updateSystemSQL);
    connection.query(updateSystemSQL, function (error, results, fields) {
    if (error) throw error;
        console.log(results.affectedRows + " record(s) updated");
    });
    connection.end();
}



//systems_update_time = datetime.now()

async function connect() {
    logger.debug('In the listener function');

    var sendData = {"action":"sub","channel":"killstream"};

    const ws = await connectToServer();

    ws.send(JSON.stringify(sendData));
    logger.debug('Sent sub message to zkill: ' + JSON.stringify(sendData));

    ws.onmessage = (webSocketMessage) => {
        const messageData = JSON.parse(webSocketMessage.data);

        // Check if we need to update ids  Math.floor((t2-t1)/(24*3600*1000))
        var minSinceLastSystemsUpdate = Math.floor((Date.now() - lastUpdateTime)/(1000*60));
        logger.debug('Received message, killId=' + messageData.killmail_id + ', solar_system_id=' + messageData.solar_system_id + '.  Min since last systems list update: ' + minSinceLastSystemsUpdate);
        if (minSinceLastSystemsUpdate > 5) {
            updateSystems(mapIds);
        }

        var systemSearchResults = systems.filter(s => s.systemId == messageData.solar_system_id);
        if (systemSearchResults.length > 0 && !ignoreSystemIds.includes(messageData.solar_system_id)) {
            logger.debug('SystemId (' + messageData.solar_system_id + ') matched one in the list.  Checking characters.');
            
            // Check character Ids
            var matchedAttackers = messageData.attackers.filter(d => mapCharacterIds.some(mapChars => mapChars.characterId == d.character_id));
            if (matchedAttackers.length == 0) {
                logger.debug("zero character matched.");
                var post = "@here A ship just died in " + systemSearchResults[0].alias + " to " + messageData.attackers.length + " people, zkill link: https://zkillboard.com/kill/" + messageData.killmail_id + "/";
                updateMapDetails(messageData.solar_system_id, 4);
                sendMessageMessage(webhookId, webhookToken, post);
            } 
            else {
                logger.debug("Skipped sendings, found matching characters.  Char[0]=" + matchedAttackers[0].character_id);
            }
        }
    };

    ws.on('close', function() {
        console.log('**** SOCKET CLOSED');
        setTimeout(connect, reconnectInterval);
    });

    async function connectToServer() {
        logger.debug("Connecting to server");
        const ws = new WebSocket(ZKILL_SOCKET);
        return new Promise((resolve, reject) => {
            logger.debug("In the promise");
            const timer = setInterval(() => {
                if(ws.readyState === 1) {
                    clearInterval(timer);
                    resolve(ws);
                }
            }, 10);
        });
    }

};

connect();