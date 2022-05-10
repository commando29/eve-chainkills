const WebSocket = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const { WebhookClient } = require('discord.js');
const util = require('util');
const mysql = require('mysql2/promise');
const { createLogger, format, transports } = require("winston");
var config = require("./config.json");
const fetch = require('cross-fetch');
const { mainModule } = require('process');

// ChainKillChecker
// logger - winston logger instance
// config object
class SystemStats {
    constructor(logger, config) {
        this.config = config;
        this.logger = logger;
        this.activityMinPercentage = 60;  // Activity time is consider active if with this percentage of actiivty max
        //this.webhookId= this.config.discordChainkillWebhookId;
        //this.webhookToken = this.config.discordChainkillWebhookToken;
        this.mapIds = this.config.mapIds;
        this.ignoreSystemIds = this.config.ignoreSystemIds;
        this.dbConfig = {
            host     : this.config.dbHost,
            user     : this.config.dbUser,
            password : this.config.dbPass,
            database : this.config.dbName,
        };

        this.logger.debug("Loaded config.  MapsID=" + this.mapIds.split(','));
        this.mapIdsArray = this.mapIds.split(',').filter(item => item > 0);

        this.zkillHeaders = {
            'Accept-Encoding': 'gzip',
            'User-Agent': 'PathfinderStatsScript',
            'Maintainer': 'Caleb bcartwright29@gmail.com'
        };

    }

    ZKILL_SOCKET = 'wss://zkillboard.com/websocket/';
    MIN_TO_GET_LATEST_SYSTEMS = 0;
    MIN_TO_SEND_DISCORD_STATUS = config.discordStatusReportMins;
    systems = [];
    mapCharacterIds = [];
    lastUpdateTime = Date.now();
    lastDiscordStatusTime = Date.now();
    systemDescription = '';

    /**
     * Handles the actual sending request.
     * We're turning the https.request into a promise here for convenience
     * @param webhookURL
     * @param messageBody
     * @return {Promise}
     */
    async constructSystemStats (systemId, systemName) {
        return await this.getSystemStats(systemId);
    }

    async getSystemStats(systemId) {


        const response = await fetch('https://zkillboard.com/api/stats/solarSystemID/' + systemId + '/', { headers: this.zkillHeaders });
        const data = await response.json();

        var corpIds = [];

        this.systemDescription = `-- Automatic Intel System for ${this.makeZSLink(data.info.id, data.info.name)} pulling last 10 days <br><br> nbsp; &nbsp; &nbsp;${new Date().toString()}<br>`;

        var topAlliances = data.topLists.filter(d => d.type == "alliance");
        if (topAlliances) {
            this.systemDescription += `Alliances:\n`
            for (const alliance of topAlliances[0].values) {
                let allianceData = await this.getAllianceStats(alliance.id);
                if (allianceData) {
                    var allianceActivePvp = 'None';
                    if (allianceData.activepvp && allianceData.activepvp.kills) {
                        allianceActivePvp = `${allianceData.activepvp.kills.count} kills and losses`
                    }
                    this.systemDescription += `${this.makeZALink(allianceData.info.id, allianceData.info.name)}: 7 day activity: ${allianceActivePvp}<br>`;

                    var topCorporations = allianceData.topLists.filter(d => d.type == "corporation");
                    if (topCorporations && topCorporations.length > 0) {
                        for (const corp of topCorporations[0].values) {
                            if (!corpIds.find(c => c == corp.id)) {
                                corpIds.push(corp.id);
                                this.systemDescription += await this.getCorpString(corp.id);
                            }
                        }
                    }
                }
            }
        }

        var topCorps = data.topLists.filter(d => d.type == "corporation");
        if (topCorps) {
            for (const corp of topCorps[0].values) {
                if (!corpIds.find(c => c == corp.id)) {
                    this.systemDescription += await this.getCorpString(corp.id);
                }
            }
        }


        this.logger.debug(data);

        return this.systemDescription;

    }

    async getCorpString(corpId) {
        var corpString = '';

        let corpData = await this.getCorpStats(corpId);
        if (corpData) {
            var corpActivePvp = 'None';
            if (corpData.activepvp && corpData.activepvp.kills) {
                corpActivePvp = `${corpData.activepvp.kills.count} kills and losses (${corpData.activepvp.characters.count}/${corpData.info.memberCount}) Characters`
            }
            corpString += `${this.makeZCLink(corpId, corpData.info.name)}: 7 day activity: ${corpActivePvp}\n`;

            var activityTotals = new Array(24); 
            var maxActivity = 0;
            for(let hourIndex=0;hourIndex<24;hourIndex++) {
                var total = 0; 
                for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                    total += corpData.activity[dayIndex][hourIndex];
                }
                activityTotals[hourIndex] =total;
                maxActivity = maxActivity < total ? total : maxActivity; 
            }

            var activityString = '';
            var spanCounter = 0;
            for(let hourIndex=0;hourIndex<24;hourIndex++) {
                if (activityTotals[hourIndex] >= (maxActivity * (this.activityMinPercentage/100))) {
                    if (spanCounter == 0) {
                        activityString += ` [${hourIndex}`;
                    }
                    spanCounter++;
                }
                else {
                    if (spanCounter > 1) {
                        activityString += `-${hourIndex-1}]`;
                    }
                    else if (spanCounter == 1) {
                        activityString += ']';
                    }
                    spanCounter = 0;
                }
            }

            // Check if the last item was in a span
            if (spanCounter > 0) { activityString += '-0]'; }

            corpString += activityString + ' Eve Timezone Active \n';
        }

        return corpString;
    }

    async getCorpStats(corpId) {
        const response = await fetch('https://zkillboard.com/api/stats/corporationID/' + corpId + '/', { headers: this.zkillHeaders });
        return await response.json();
    }

    async getAllianceStats(allianceId) {
        const response = await fetch('https://zkillboard.com/api/stats/allianceID/' + allianceId + '/', { headers: this.zkillHeaders });
        return await response.json();
    }

    makeLink(url,title) {
        return `<a href="${url}" target="_blank">${title}</a>`
    }

    makeZALink(allianceId,title) {
        return this.makeLink(`https://zkillboard.com/alliance/${allianceId}/`, title)
    }

    makeZCLink(corpId,title) {
        return this.makeLink(`https://zkillboard.com/corporation/${corpId}/`, title)
    }

    makeZSLink(systemId,title) {
        return this.makeLink(`https://zkillboard.com/system/${systemId}/`, title)
    }
}


const logger = createLogger({
    level: config.logLevel,
    format: format.combine(
      format.timestamp(),
      format.json()
    ),
    transports: [new transports.Console()],
});

async function getStats() {
    var x = new SystemStats(logger, config);
    //var stats = await x.constructSystemStats(31001394);
    var stats = await x.constructSystemStats(31001512);
    console.log(stats);
}
getStats();