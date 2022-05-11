const WebSocket = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const { WebhookClient } = require('discord.js');
const util = require('util');
const mysql = require('mysql2/promise');
const { config } = require('process');

// ChainKillChecker
// logger - winston logger instance
// config object
class ChainKillChecker {
    constructor(logger, config) {
        this.config = config;
        this.logger = logger;
        //this.webhookId= this.config.discordChainkillWebhookId;
        //this.webhookToken = this.config.discordChainkillWebhookToken;
        this.mapIds = this.config.mapIds;
        this.ignoreSystemIds = this.config.ignoreSystemIds ? this.config.ignoreSystemIds : [];
        this.dbConfig = {
            host     : this.config.dbHost,
            user     : this.config.dbUser,
            password : this.config.dbPass,
            database : this.config.dbName,
        };

        this.logger.debug("Loaded config.  MapsID=" + this.mapIds.split(','));
        this.mapIdsArray = this.mapIds.split(',').filter(item => item > 0);
        this.insightTrackedIds = config.insightTrackedIds;

    }

    ZKILL_SOCKET = 'wss://zkillboard.com/websocket/';
    MIN_TO_GET_LATEST_SYSTEMS = 0;
    MIN_TO_SEND_DISCORD_STATUS = config.discordStatusReportMins;
    systems = [];
    mapCharacters = [];
    lastUpdateTime = Date.now();
    lastDiscordStatusTime = Date.now();

    /**
     * Handles the actual sending request.
     * We're turning the https.request into a promise here for convenience
     * @param webhookURL
     * @param messageBody
     * @return {Promise}
     */
    sendChainMessage (messageBody) {
        const webhookClient = new WebhookClient({ id: this.config.discordChainkillWebhookId, token: this.config.discordChainkillWebhookToken });

        webhookClient.send({
            content: messageBody,
        });
    }

    async sendCorpKillMessage (zkillMessage, isKill) {

        var killDetails = new KillDetails(logger, config, zkillMessage);
        await killDetails.GetKillDetails();
        killDetails.isKill = isKill;
        var killEmbed = new KillEmbed(logger, config, killDetails);
        var embed = killEmbed.CreateEmbed();

        const webhookClient = new WebhookClient({ id: config.discordCorpkillWebhookId, token: config.discordCorpkillWebhookToken });

        webhookClient.send({
            embeds: [embed],
        });
    }

    async sendInfoMessage (messageBody) {
        const webhookClient = new WebhookClient({ id: this.config.discordInfoWebhookId, token: this.config.discordInfoWebhookToken });

        await webhookClient.send({
            content: messageBody,
        });
    }

    async updateSystems() {
        try {
            this.logger.info("Updating system list.");
            this.systems = [];
            var connection = await mysql.createConnection(this.dbConfig)
              .catch(err => { throw err; });
        
            await connection.execute('select systemId, alias from system where mapId in (?) and active = 1 and typeId = 1', [this.mapIds])
                .then( ([rows,fields]) => { 
                    this.systems = rows; 
                    this.logger.debug(this.systems);
                })
                .catch(err => { throw err; });

            this.lastUpdateTime = Date.now();
            connection.end();
            return;
        }
        catch(error) {
            this.logger.error("Error updateSystems : " + error);
            await this.sendInfoMessage("Error updateSystems : " + error);
            throw error;
        }
    }
    
    async getMapCharacters() {
        try {
            this.logger.info("Getting characters from database.");
            this.mapCharacterIds = [];
        
            var connection = await mysql.createConnection(this.dbConfig)
              .catch(err => { throw err; });

            await connection.execute('select cm.characterId, c.corporationId, c.allianceId from character_map cm inner join `character` c on c.id = cm.characterId where cm.mapId in (?) and cm.active = 1', [this.mapIds])
                .then( ([rows,fields]) => { 
                    this.mapCharacters = rows;
                    this.logger.info(`Found ${rows.length} map characters.`);
                })
                .catch(err => { throw err; });
            connection.end();
            return;
        }
        catch(error) {
            this.logger.error("Error getMapCharacters : " + error);
            await this.sendInfoMessage("Error getMapCharacters : " + error);
            throw error;
        }
    }

    async updateSystemStatus(systemId, statusId, systemName='unknown') {
        try {
            this.logger.info("Updating map status for " + systemName);
        
            var connection = await mysql.createConnection(this.dbConfig)
                .catch(err => { throw err; });

            const [rows, fields] = await connection.execute('update system set statusId = ?, updated = now(), updatedCharacterId = ? where systemID = ? and mapId in (?)', [statusId, this.config.characterIdForUpdates, systemId, this.mapIds])
                .catch(err => { throw err; });

            this.logger.debug(rows.affectedRows + " record(s) updated");
            connection.end();
            return;
        }
        catch(error) {
            this.logger.error("Error updateMapDetails : " + error);
            await this.sendInfoMessage("Error updateMapDetails : " + error);
            throw error;
        }
    }

    async insertSystemStatus(systemId, statusId, mapId, active, alias) {
        try {
            this.logger.info("Updating map details");
        
            var connection = await mysql.createConnection(this.dbConfig)
                .catch(err => { throw err; });

            var charId = this.config.characterIdForUpdates;

            this.logger.info("Inserting for following values: systemId=" + systemId + ", statusId=" + statusId + ",mapId=" + mapId + ",active=" + active + ",alias=" + alias);

            var insertSQL = `
                insert into system(created, updated, createdCharacterId, updatedCharacterId, active, mapId, systemId, alias, typeId, statusId, 
                                locked, rallyUpdated, rallyPoke, description, PosX, PosY) 
                values(now(), now(), ?, ?, ?, ?, ?, ?, 1, ?, 0, null, 0, null, 0, 0);
            `;

            const [rows, fields] = await connection.execute(insertSQL, [charId, charId, active, mapId, systemId, alias, statusId])
                .catch(err => { throw err; });

            this.logger.debug(rows.affectedRows + " record(s) updated");
            connection.end();
            return;
        }
        catch(error) {
            this.logger.error("Error updateMapDetails : " + error);
            await this.sendInfoMessage("Error updateMapDetails : " + error);
            throw error;
        }
    }

    // If this kill happened in a JSig, update the map to red to indicate the activity incase we jump into it
    async fullSystemCheck(systemId) {
        try {
            let jsig_pattern = /^J\d{4,}/;
            this.logger.info("fullSystemCheck");
        
            var connection = await mysql.createConnection(this.dbConfig)
                .catch(err => { throw err; });

            const [rows, fields] = await connection.execute('select eus.name, eus.security, eus.effect, ps.alias, ps.mapId  from eve_universe.system eus left join pf.system ps on ps.systemId = eus.id and ps.mapId in (?) where eus.id = ?;', [this.mapIds, systemId])
                .catch(err => { throw err; });

            connection.end();

            // Check if we got a J system
            if (rows.length > 0 && jsig_pattern.test(rows[0].name)) {
                this.logger.debug("fullSystemCheck - kill is for system name: " + rows[0].name );
                var didMapsUpdate = false;  // Updates are done for all mapids, so ensure we only run it once
                // Check if there is already a record for each map id
                for (const mapId of this.mapIdsArray) {
                    if (mapId == 0) { continue; }
                    // If update
                    if (rows.filter(r => r.mapId == mapId).length > 0) {
                        if (!didMapsUpdate) {
                            this.logger.debug("fullSystemCheck - updating existing system");
                            this.updateSystemStatus(systemId, 4, rows[0].name);
                        }
                        didMapsUpdate = true;
                    }
                    else {
                        // Insert
                        
                        this.logger.debug("fullSystemCheck - Calling to inserting the following values: systemId=" + systemId + ", statusId=" + 4 + ",mapId=" + mapId + ",active=" + 0 + ",alias=" + rows[0].name)
                        this.insertSystemStatus(systemId, 4, mapId, 0, rows[0].name);
                    }
                }
            }
            else if (rows.length > 0 && !rows[0].name.match(/[J]\d+3/)) {
                this.logger.debug("[fullSystemCheck] - Name match failure for systemId:" + systemId + ",name=" + rows[0].name);
            }
            else {
                // This will happen frequently for beginner systems
                this.logger.debug("[fullSystemCheck] - No systems details found for systemId : " + systemId);
                //await this.sendInfoMessage("[fullSystemCheck] - No systems details found for systemId : " + systemId);
            }

            connection.end();
            return;
        }
        catch(error) {
            this.logger.error("Error fullSystemCheck : " + error);
            await this.sendInfoMessage("Error fullSystemCheck : " + error);
            throw error;
        }
    }

    async handleZKillMessage(jsonData) {
        const messageData = JSON.parse(jsonData);

        // Send status update to discord if it's time.
        if (Math.floor((Date.now() - this.lastDiscordStatusTime)/(1000*60)) > this.MIN_TO_SEND_DISCORD_STATUS) {
            this.lastDiscordStatusTime = Date.now();
            await this.sendInfoMessage("Chainkills checker running.");
        }
    
        // Check if we need to update ids  Math.floor((t2-t1)/(24*3600*1000))
        var minSinceLastSystemsUpdate = Math.floor((Date.now() - this.lastUpdateTime)/(1000*60));
        this.logger.debug('Received message, killId=' + messageData.killmail_id + ', solar_system_id=' + messageData.solar_system_id + '.  Min since last systems list update: ' + minSinceLastSystemsUpdate);
        if (minSinceLastSystemsUpdate > this.MIN_TO_GET_LATEST_SYSTEMS) {
            await this.updateSystems();
        }

        // Check if this is a corp/alliance in the map, which would mean we send the mail to the kill channel (old insight)
        var matchedCorpKill = false;
        var isKill = false;
        var allianceId = messageData.victim.alliance_id ? messageData.victim.alliance_id : -1;
        var matchedCorpKill = this.insightTrackedIds.includes(messageData.victim.corporation_id) || this.insightTrackedIds.includes(allianceId);
        if (matchedCorpKill) {
            this.logger.debug(`KillId ${messageData.killmail_id} got a victim match.  zKill corpid = ${messageData.victim.corporation_id}.  zkill allianceId=${messageData.victim.alliance_id}.`);
            isKill = false;
        }
        else {
            var matchedAttackersCorp = messageData.attackers.filter(d => this.insightTrackedIds.some(item => item == d.corporation_id));
            if (matchedAttackersCorp.length > 0) {
                this.logger.debug(`KillId ${messageData.killmail_id} got an attacker corp match.  matched corpid = ${matchedVictim.corporation_id}.`);
                isKill = true;
                matchedCorpKill = true;
            }
            else {
                var matchedAttackersAlli = messageData.attackers.filter(d => this.insightTrackedIds.some(item => item == d.alliance_id));
                if (matchedAttackersAlli.length > 0) {
                    this.logger.debug(`KillId ${messageData.killmail_id} got an attacker alliance match.  matched allianceId = ${matchedVictim.alliance_id}.`);
                    isKill = true;
                    matchedCorpKill = true;
                }
            }
        }


        if (matchedCorpKill) {
            this.sendCorpKillMessage(messageData, isKill);
        }
        else {
            // Check if this is a system in a map
            var systemSearchResults = this.systems.filter(s => s.systemId == messageData.solar_system_id);
            if (systemSearchResults.length > 0 && !this.ignoreSystemIds.includes(messageData.solar_system_id)) {
                this.logger.debug('SystemId (' + messageData.solar_system_id + ') matched one in the list.  Checking characters.');
                
                // Check character Ids
                var matchedAttackers = messageData.attackers.filter(d => this.mapCharacters.some(mapChars => mapChars.characterId == d.character_id));
                if (matchedAttackers.length == 0) {
                    this.logger.debug("zero character matched in list of " + this.mapCharacters.length);
                    var post = "@here A ship just died in " + systemSearchResults[0].alias + " to " + messageData.attackers.length + " people, zkill link: https://zkillboard.com/kill/" + messageData.killmail_id + "/";
                    this.updateSystemStatus(messageData.solar_system_id, 4);
                    this.sendChainMessage(post);
                } 
                else {
                    this.logger.debug("Skipped sendings, found matching characters.  Char[0]=" + matchedAttackers[0].character_id);
                }
            }
            else {
                this.fullSystemCheck(messageData.solar_system_id);
            }
        }
    }

    async StartListening() {
        this.logger.debug('Starting up zkill listener');

        // Get the data from the db, comment out if debugging locally with no db
        await this.updateSystems();
        await this.getMapCharacters();

    
        var sendData = {"action":"sub","channel":"killstream"};
    
        const rws = new ReconnectingWebSocket(this.ZKILL_SOCKET, [], {
            WebSocket: WebSocket,
            connectionTimeout: 10000,  // in milliseconds
            reconnectInterval: 10000,
        });
    
        rws.addEventListener('open', () => {
            rws.send(JSON.stringify(sendData));
            
            this.sendInfoMessage("zkill socket opened.");

            this.logger.debug('Sent sub message to zkill: ' + JSON.stringify(sendData));
        });
    
        rws.addEventListener('message', (data) => {
            this.handleZKillMessage(data.data.toString());
        });
    
        rws.addEventListener('close', () => {
            this.logger.info('**** SOCKET CLOSED');
            this.sendInfoMessage("zkill socket closed.");
        });
    
        rws.addEventListener('error', function(event) {
            this.sendInfoMessage("zkill socket error : " + event);
            this.logger.error('**** SOCKET ERROR: ' + event);
        });
    
    };
}

module.exports = { ChainKillChecker };