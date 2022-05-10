
const { createLogger, format, transports } = require("winston");
var config = require("./config.json");
const fetch = require('cross-fetch');

// ChainKillChecker
// logger - winston logger instance
// config object
class KillDetails {
    constructor(logger, config, characterId) {
        this.config = config;
        this.logger = logger;
        this.characterId = characterId;
        this.charData = {};
        /*this.name = '';
        this.birthday = null,
        this.bloodline_id = 0;
        this.corporation_id = 0;
        this.description= 'No pirate.  Just a friendly bear.',
        this.gender= 'male';
        this.name= "";
        this.race_id=0,
        this.security_status= 0.08811521300000001; */
    }

    async GetCharacterDetails() {
        characterURL = "https://esi.evetech.net/latest/characters/@0/?datasource=tranquility";

        try {
            let urls = [
              this.characterURL.replace('@0', this.characterId),
            ];

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
        
            this.charData = data[0];
            
          } 
          catch (errors) {
            errors.forEach((error) => console.error(error));
          }
    }

}