const { WebhookClient, MessageEmbed } = require('discord.js');
const { createLogger, format, transports } = require("winston");
var config = require("./config.json");
const { mainModule, kill } = require('process');
const { KillDetails } = require("./killdetails");


// logger - winston logger instance
// config object
class KillEmbed {
    constructor(logger, config, killDetails) {
        this.config = config;
        this.logger = logger;

        // TODO - Change this to corp kill later
        this.webhookId= this.config.discordChainkillWebhookId;
        this.webhookToken = this.config.discordChainkillWebhookToken;

        this.killDetails = killDetails;
    }


    /* Text variable names:
        @killId
        @systemName
        @victimShipName
    */
    CreateEmbed() {

        try {
            var zkillLink = 'https://zkillboard.com/kill/@killId/'.replace('@killId', this.killDetails.killId);
            const authorText = this.killDetails.isKill ? "Kill" : "Loss";
            var authorImage = "";
            if (this.killDetails.victimAllianceId > 0) {
                authorImage = "https://image.eveonline.com/Alliance/@allianceId_64.png".replace('@allianceId', this.killDetails.victimAllianceId);
            }
            else {
                authorImage = "https://image.eveonline.com/Corporation/@corporationId_64.png".replace('@corporationId', this.killDetails.victimCorporationId);
            }

            var description = '**[@victimCharName](@victimZkillURL)(@victimGroupName)** lost their **@victimShipName** to **[@attackerCharName](@attackerZkillURL)(@attackerGroupName)** flying in a **@attackerShipName** @descriptionEnd.'
            description = description.replace('@victimCharName', this.killDetails.victimCharacterName)
                                    .replace('@victimZkillURL', `https://zkillboard.com/character/${this.killDetails.victimCharacterId}/`)
                                    .replace('@victimGroupName', this.killDetails.victimAllianceId ? this.killDetails.victimAllianceName : this.killDetails.victimCorporationName)
                                    .replace('@victimShipName', this.killDetails.victimShipName)
                                    .replace('@attackerCharName', this.killDetails.attackerChartacterName)
                                    .replace('@attackerZkillURL', `https://zkillboard.com/character/${this.killDetails.attackerCharacterId}/`)
                                    .replace('@attackerGroupName', this.killDetails.attackerAllianceId ? this.killDetails.attackerAllianceName : this.killDetails.attackerCorporationName)
                                    .replace('@attackerShipName', this.killDetails.attackerShipName)
                                    .replace('@descriptionEnd', this.killDetails.attackersCount == 1 ? "solo" : "and **" + this.killDetails.attackersCount.toString() + "** others");


            // inside a command, event listener, etc.
            var embed = new MessageEmbed()
                .setColor(this.isKill ? this.config.discordKillNotifications.killColor : this.config.discordKillNotifications.lossColor )
                .setTitle('@victimShipName destroyed in @systemName'.replace('@systemName', this.killDetails.systemName)
                                                                    .replace('@victimShipName', this.killDetails.victimShipName))
                .setURL(zkillLink)
                .setAuthor({ name: this.killDetails.isKill ? "Kill" : "Loss", iconURL: authorImage, url: zkillLink })
                .setDescription(description)
                .setThumbnail('https://image.eveonline.com/Type/@shipId_64.png'.replace("@shipId", this.killDetails.victimShipId))
                /*.addFields(
                    { name: 'Regular field title', value: 'Some value here' },
                    { name: '\u200B', value: '\u200B' },
                    { name: 'Inline field title', value: 'Some value here', inline: true },
                    { name: 'Inline field title', value: 'Some value here', inline: true },
                )
                .addField('Inline field title', 'Some value here', true)*/
                //.setImage('https://i.imgur.com/AfFp7pu.png')
                .setTimestamp()
                .setFooter({ text: 'Value: @iskValue'.replace('@iskValue', this.formatAmount(this.killDetails.iskValue)) });

            return embed;
        }
        catch (error) {
            logger.error(error);
        }
    }

    numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    formatAmount(x) {
        try {
            if (x >= 1000000000) {
                return `${Math.round(parseFloat(x / 1000000000) * 10) / 10}b`
                //'${num}b';
            }
            else if (x >= 1000000) {
                return `${Math.round(parseFloat(x / 1000000) * 10) / 10}m`;
                //return '${num}m';
            }
            else {
                return `${Math.round(parseFloat(x / 10000) * 10) / 10}k`;
                //return '${num}k';
            }
        }
        catch (error) {
            logger.error(error);
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
    var testKillDetails = new KillDetails(logger, config, testObj);
    await testKillDetails.GetKillDetails();
    var killEmbed = new KillEmbed(logger, config, testKillDetails);
    var embed = killEmbed.CreateEmbed();

    const webhookClient = new WebhookClient({ id: config.discordChainkillWebhookId, token: config.discordChainkillWebhookToken });

    webhookClient.send({
        embeds: [embed],
    });
}
//test();

module.exports = { KillEmbed }