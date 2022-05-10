
/* DB Cleanup Steps:
    1. Get system records that need to be reset
    2. Execute update
*/
const mysql = require('mysql2/promise');

async function cleanupSystems(logger, dbConfig, mapIds, updatedCharacterId) {
    try {
        logger.info("Cleaning up systems.");
        
        var connection = await mysql.createConnection(dbConfig)
          .catch(err => { throw err; });
    
        await connection.execute('update system set statusId = 1 where mapId in (?) and statusId = 4 and updatedCharacterId = ? and updated < now() - interval 90 minute;', [mapIds, updatedCharacterId])
          .then( ([rows,fields]) => { this.systems ==rows; })
          .catch(err => { 
            logger.error("Error updateSystems : " + error);
          });

        connection.end();
        return;
    }
    catch(error) {
        logger.error("Error updateSystems : " + error);
    }
}

module.exports = { cleanupSystems }