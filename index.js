
const { createLogger, format, transports } = require("winston");
const { ChainKillChecker } = require('./chainkills');
let dbcleanup = require('./dbcleanup');
var config = require("./config.json");
var cron = require('node-cron');

const dbConfig = {
    host     : config.dbHost,
    user     : config.dbUser,
    password : config.dbPass,
    database : config.dbName,
};

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [new transports.Console()],
});

// Setup cron jobs
cron.schedule('00 */30 * * * *', () => {
    try {
        logger.info("***Starting cleanupSystems.");
        dbcleanup.cleanupSystems(logger, dbConfig, config.mapIds, config.characterIdForUpdates);
        logger.info("***Finished cleanupSystems.");
    }
    catch(err) {
        logger.error("Error in cleanup cron job: " + err);
    }
});

const chainKillChecker = new ChainKillChecker(logger, config);
chainKillChecker.StartListening();
logger.info("Started chain kill checker.");
