const WebSocket = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const { WebhookClient } = require('discord.js');
const mysql = require('mysql2/promise');
const { createLogger, format, transports } = require("winston");
var config = require("./config.json");
const fetch = require('cross-fetch');
const { mainModule } = require('process');

// ChainKillChecker
// logger - winston logger instance
// config object
class KillEmbed {
    constructor(logger, config, zkillStreamKill) {
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

        this.killId = zkillStreamKill.killmail_id;
        this.victimCharacterId = zkillStreamKill.victim.character_id;
        this.victimCorporationId = zkillStreamKill.victim.corporation_id;
        this.victimAllianceId = zkillStreamKill.victim.alliance_id;
        this.victimCharacterName = '';
        this.victimCorporationName = '';
        this.victimallianceName = '';
        this.isKill = false;
        this.victimShipId = zkillStreamKill.victim.ship_type_id;
        this.victimShipName = '';
        this.attackerCharacterId = zkillStreamKill.attackers[0].character_id;
        this.attackerCorporationId = zkillStreamKill.attackers[0].corporation_id;
        this.attackerAllianceId = zkillStreamKill.attackers[0].alliance_id;
        this.attackerCorporationName = '';
        this.attackerAllianceName = '';
        this.attackerChartacterName = '';
        this.attackerShipId = zkillStreamKill.attackers[0].ship_type_id;
        this.attackerShipName = '';
        this.attackersCount = zkillStreamKill.attackers.length;
        this.systemId = zkillStreamKill.solar_system_id;
        this.systemName = '';
        this.iskValue = zkillStreamKill.totalValue;


        this.zkillHeaders = {
            'Accept-Encoding': 'gzip',
            'User-Agent': 'PathfinderStatsScript',
            'Maintainer': 'Caleb bcartwright29@gmail.com'
        };



    }

    allianceURL = "https://esi.evetech.net/latest/alliances/@0/?datasource=tranquility";
    corporationURL = "https://esi.evetech.net/latest/corporations/@0/?datasource=tranquility";
    characterURL = "https://esi.evetech.net/latest/characters/@0/?datasource=tranquility";
    typeURL = "https://esi.evetech.net/latest/universe/types/@0/?datasource=tranquility&language=en";
    systemURL = "https://esi.evetech.net/latest/universe/systems/@0/?datasource=tranquility&language=en";

    async GetRelatedData() {

        try {
            let urls = [
              
              this.corporationURL.replace('@0', this.attackerCorporationId),
              this.characterURL.replace('@0', this.attackerCharacterId),
              this.typeURL.replace('@0', this.attackerShipId),
              this.corporationURL.replace('@0', this.victimCorporationId),
              this.characterURL.replace('@0', this.victimCharacterId),
              this.typeURL.replace('@0', this.victimShipId),
              this.systemURL.replace('@0', this.systemId)
            ];

            if (this.attackerAllianceId) {
                urls.push(this.allianceURL.replace('@0', this.attackerAllianceId));
            }
            if (this.victimAllianceId) {
                urls.push(this.allianceURL.replace('@0', this.victimAllianceId));
            }

            const requests = urls.map((url) => fetch(url));
            const responses = await Promise.all(requests);
            const errors = responses.filter((response) => !response.ok);
        
            if (errors.length > 0) {
              errors.map(response => {
                logger.error(`ESI Data Fetch Error: ${response.status} from ${response.url}`);
              });
            }
        
            const json = responses.map((response) => response.json());
            const data = await Promise.all(json);
        
            //data.forEach((datum) => console.log(datum));
            this.attackerCorporationName = data[0].name;
            this.attackerChartacterName = data[1].name;
            this.attackerShipName = data[2].name;
            this.victimCorporationName = data[3].name;
            this.victimCharacterName = data[4].name;
            this.victimShipName = data[5].name;
            this.systemName = data[6].name;

            if (this.attackerAllianceId) {
                this.attackerAllianceName = data[7].name;
            }
            else if (this.victimAllianceId) {
                this.victimAllianceName = data[7].name;
            }

            if (this.attackerAllianceId && this.victimAllianceId) {
                this.victimAllianceName = data[8].name;
            }
          }
          catch (errors) {
            errors.forEach((error) => console.error(error));
          }
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

async function test() {
    var testObj = {"attackers":[{"alliance_id":99004295,"character_id":96726904,"corporation_id":98578883,"damage_done":572,"final_blow":true,"security_status":-2.3,"ship_type_id":16242,"weapon_type_id":2977}],"killmail_id":100721758,"killmail_time":"2022-05-09T17:52:19Z","solar_system_id":30000142,"victim":{"character_id":95675904,"corporation_id":1000115,"damage_taken":572,"items":[{"flag":5,"item_type_id":21200,"quantity_dropped":5,"singleton":0},{"flag":20,"item_type_id":30328,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":49621,"quantity_destroyed":1,"singleton":0},{"flag":5,"item_type_id":46001,"quantity_dropped":48,"singleton":0},{"flag":27,"item_type_id":3640,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":13976,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":43530,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":14070,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":34746,"quantity_destroyed":2,"singleton":0},{"flag":5,"item_type_id":33577,"quantity_destroyed":2,"singleton":0},{"flag":5,"item_type_id":46004,"quantity_destroyed":41,"singleton":0},{"flag":5,"item_type_id":21206,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":42754,"quantity_destroyed":1,"singleton":0},{"flag":5,"item_type_id":42773,"quantity_destroyed":1,"singleton":0},{"flag":11,"item_type_id":2046,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":46002,"quantity_destroyed":8,"singleton":0},{"flag":5,"item_type_id":34732,"quantity_destroyed":1,"singleton":0},{"flag":5,"item_type_id":19406,"quantity_destroyed":1,"singleton":0},{"flag":5,"item_type_id":14088,"quantity_dropped":1,"singleton":0},{"flag":5,"item_type_id":42784,"quantity_destroyed":1,"singleton":0},{"flag":19,"item_type_id":30420,"quantity_destroyed":1,"singleton":0},{"flag":5,"item_type_id":14027,"quantity_destroyed":1,"singleton":0}],"position":{"x":-4067676871603.42,"y":-710577074290.6902,"z":-3956622579324.895},"ship_type_id":606},"zkb":{"locationID":50001249,"hash":"5da58e8b0eccb88357a1e7b2a4abc7853a1bcb1d","fittedValue":18843.02,"droppedValue":56349144.21,"destroyedValue":52239034.27,"totalValue":108588178.48,"points":6,"npc":false,"solo":false,"awox":false,"esi":"https:\/\/esi.evetech.net\/latest\/killmails\/100721758\/5da58e8b0eccb88357a1e7b2a4abc7853a1bcb1d\/","url":"https:\/\/zkillboard.com\/kill\/100721758\/"}};
    var testEmbed = new KillEmbed(logger, config, testObj);
    await testEmbed.GetRelatedData();
}
test();

module.exports = { KillEmbed }