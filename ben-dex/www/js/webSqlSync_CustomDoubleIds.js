/*******************************************************************
 * Sync a local WebSQL DB (SQLite) with a server.
 * Thanks to Lee Barney and QuickConnect for his inspiration
 ******************************************************************/
/*
 Copyright (c) 2012, Samuel Michelot,  MosaCrea Ltd
 Permission is hereby granted, free of charge, to any person obtaining a
 copy of this software and associated documentation files (the "Software"),
 to deal in the Software without restriction, including without limitation the
 rights to use, copy, modify, merge, publish, distribute, sublicense,
 and/or sell copies of the Software, and to permit persons to whom the Software
 is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.


 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
 OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else {
        // Browser globals
        root.DBSYNC = factory();
    }
}(this, function () {

var DBSYNC = {
    serverUrl: null,
    db: null,
    tablesToSync: [],//eg.  [{tableName : 'myDbTable', idNames : ['myTable_id', 'myTable_deviceId'] },{tableName : 'stat'}]
    idNamesFromTableName : {}, //map to get the idNames with the tableName (key)
    syncInfo: {//this object can have other useful info for the server ex. {deviceId : "XXXX", email : "fake@g.com"}
        lastSyncDate : null// attribute managed by webSqlSync
    },
    syncResult: null,
    firstSync: false,
    cbEndSync: null,
    clientData: null,
    serverData: null,

    /*************** PUBLIC FUNCTIONS ********************/
    /**
     * Initialize the synchronization (should be called before any call to syncNow)
     * (it will create automatically the necessary tables and triggers if needed)
     * @param {Object} theTablesToSync : ex : [{ tableName: 'card_stat', idNames: ['card_id', 'card_deviceId']}, {tableName: 'stat'}] //no need to precise id if the idName is "id".
     * @param {Object} dbObject : the WebSQL database object.
     * @param {Object} theSyncInfo : will be sent to the server (useful to store any ID or device info).
     * @param {Object} theServerUrl
     * @param {Object} callBack(firstInit) : called when init finished.
     */
    initSync: function(theTablesToSync, dbObject, theSyncInfo, theServerUrl, callBack) {
        var self = this, i = 0, j = 0;
        this.db = dbObject;
        this.serverUrl = theServerUrl;
        this.tablesToSync = theTablesToSync;
        this.syncInfo = theSyncInfo;
        //Handle optional id :
        for (i = 0; i < self.tablesToSync.length; i++) {
            if (typeof self.tablesToSync[i].idNames === 'undefined') {
                self.tablesToSync[i].idNames = ['id'];//if not specified, the default id setup is a single id named 'id'
            }
            self.idNamesFromTableName[self.tablesToSync[i].tableName] = self.tablesToSync[i].idNames;
        }

        self.db.transaction(function (transaction) {
            //create new tables to store modified or new elems
        	self._executeSql('CREATE TABLE IF NOT EXISTS new_elem (change_id INTEGER PRIMARY KEY NOT NULL, table_name TEXT NOT NULL);', [], transaction);
        	self._executeSql('CREATE TABLE IF NOT EXISTS new_elem_ids (change_id INTEGER NOT NULL, id_val TEXT NOT NULL, id_order INT NOT NULL, ' +
        		'FOREIGN KEY(change_id) REFERENCES new_elem(change_id));', [], transaction);
        	self._executeSql('CREATE INDEX IF NOT EXISTS index_tableName_newElem on new_elem (table_name)', [], transaction);
        	self._executeSql('CREATE INDEX IF NOT EXISTS index_changeId_newElemIds on new_elem_ids (change_id)', [], transaction);
            self._executeSql('CREATE TABLE IF NOT EXISTS sync_info (last_sync TIMESTAMP);', [], transaction);

            //create triggers to automatically fill the new_elem tables (these tables will contain pointers to all the modified data)
            for (i = 0; i < self.tablesToSync.length; i++) {
            	var curr = self.tablesToSync[i];
            	var currInsertValues = [];
            	//First inserted values on multi-row insert require different syntax
            	currInsertValues.push('last_insert_rowid() AS change_id, NEW.' + curr.idNames[0] + ' AS id_val, 0 AS id_order');
            	for (j = 1; j < curr.idNames.length; j++) { 
            		currInsertValues.push('last_insert_rowid(), NEW.' + curr.idNames[j] + ', ' + j);
            	}
            	currInsertValuesStr = self._arrayToString(currInsertValues, ' UNION SELECT ');
                self._executeSql('CREATE TRIGGER IF NOT EXISTS update_' + curr.tableName + ' AFTER UPDATE ON ' + curr.tableName + ' ' +
                        'BEGIN INSERT INTO new_elem (table_name) VALUES ("' + curr.tableName + '");' + 
						'INSERT INTO new_elem_ids SELECT ' + currInsertValuesStr + ';' + 
						'END;', [], transaction);

                self._executeSql('CREATE TRIGGER IF NOT EXISTS insert_' + curr.tableName + ' AFTER INSERT ON ' + curr.tableName + ' ' +
                        'BEGIN INSERT INTO new_elem (table_name) VALUES ("' + curr.tableName + '");' +
						'INSERT INTO new_elem_ids SELECT ' + currInsertValuesStr + ';' +
						'END;', [], transaction);
                //TODO the DELETE is not handled. But it's not a pb if you do a logic delete (ex. update set state="DELETED")
            }
        });//end tx
        self._selectSql('SELECT last_sync FROM sync_info', null, function(res) {

            if (res.length === 0 || res[0] == 0) {//First sync (or data lost)
                self._executeSql('INSERT OR REPLACE INTO sync_info (last_sync) VALUES (0)', []);
                self.firstSync = true;
                self.syncInfo.lastSyncDate = 0;
                callBack(true);
            } else {
                self.syncInfo.lastSyncDate = res[0].last_sync;
                if (self.syncInfo.lastSyncDate === 0) {
                    self.firstSync = true;
                }
                callBack(false);
            }
        });
    },

    /**
     *
     * @param {function} callBackProgress
     * @param {function} callBackEnd (result.syncOK, result.message).
     * @param {boolean} saveBandwidth (default false): if true, the client will not send a request to the server if there is no local changes
     */
    syncNow: function(callBackProgress, callBackEndSync, saveBandwidth) {
        var self = this;
        if (this.db === null) {
            throw 'You should call the initSync before (db is null)';
        }

        self.syncResult = {syncOK: false, codeStr: 'noSync', message: 'No Sync yet', nbSent : 0, nbUpdated:0};

        self.cbEndSync = function() {
            callBackProgress(self.syncResult.message, 100, self.syncResult.codeStr);
            callBackEndSync(self.syncResult);
        };

        callBackProgress('Getting local data to backup', 0, 'getData');

        self._getDataToBackup(function(data) {
            self.clientData = data;
            if (saveBandwidth && self.syncResult.nbSent === 0) {
                self.syncResult.localDataUpdated = false;
                self.syncResult.syncOK = true;
                self.syncResult.codeStr = 'nothingToSend';
                self.syncResult.message = 'No new data to send to the server';
                self.cbEndSync(self.syncResult);
                return
            } 

            callBackProgress('Sending ' + self.syncResult.nbSent + ' elements to the server', 20, 'sendData');

            self._sendDataToServer(data, function(serverData) {

                callBackProgress('Updating local data', 70, 'updateData');

                self._updateLocalDb(serverData, function() {
                    self.syncResult.localDataUpdated = self.syncResult.nbUpdated > 0;
                    self.syncResult.syncOK = true;
                    self.syncResult.codeStr = 'syncOk';
                    self.syncResult.message = 'Data synchronized successfuly. ('+self.syncResult.nbSent+
                        ' new/modified element saved, '+self.syncResult.nbUpdated+' updated)';
                    self.syncResult.serverAnswer = serverData;//include the original server answer, just in case
                    self.cbEndSync(self.syncResult);
                });
            });
        });

    },

    /* You can override the following methods to use your own log */
    log: function(message) {
        console.log(message);
    },
    error: function(message) {
        console.error(message);
    },
    getLastSyncDate : function() {
        return this.syncInfo.lastSyncDate;
    },
    // Usefull to tell the server to resend all the data from a particular Date (val = 1 : the server will send all his data)
    setSyncDate: function(val) {
        this.syncInfo.lastSyncDate = val;
        this._executeSql('UPDATE sync_info SET last_sync = "'+this.syncInfo.lastSyncDate+'"', []);
    },
    //Useful to tell the client to send all his data again (like the firstSync)
    setFirstSync: function() {
        this.firstSync = true;
        this.syncInfo.lastSyncDate = 0;
        this._executeSql('UPDATE sync_info SET last_sync = "'+this.syncInfo.lastSyncDate+'"', []);
    },
    /*************** PRIVATE FUNCTIONS ********************/

    _getDataToBackup: function(callBack) {
        var self = this, nbData = 0;
        self.log('_getDataToBackup');
        var dataToSync = {
            info: self.syncInfo,
            data: {}
        };

        self.db.transaction(function(tx) {
            var i, counter = 0, nbTables = self.tablesToSync.length, currTable;

            self.tablesToSync.forEach(function(currTable) {//a simple for will not work here because we have an asynchronous call inside
                self._getDataToSave(currTable.tableName, currTable.idNames, self.firstSync, tx, function(data) {
                    dataToSync.data[currTable.tableName] = data;
                    nbData += data.length;
                    counter++;
                    if (counter === nbTables) {//only call the callback at the last table
                        self.log('Data fetched from the local DB');
                        //dataToSync.info.nbDataToBackup = nbData;
                        self.syncResult.nbSent = nbData;
                        callBack(dataToSync);
                    }
                });
            });//end for each
        });//end tx
    },

    _getDataToSave: function(tableName, idNames, needAllData, tx, dataCallBack) {
        var self = this, sql = '';
        if (needAllData) {
        	self._selectSql('SELECT * FROM ' + tableName, tx, dataCallBack);
        } else {
        	
        	//Set up parts of query that need iterated 
        	var tempTableName = tableName + '_new_elem_ids';
        	var idNamesAsSqlCols = [];
        	var tempTableSelectClause = [];
        	var tempTableJoinClauses = [];
        	var idsMatchJoinClause = [];
        	for (var i = 0; i < idNames.length; i++) {
        		var idAlias = 'id' + i;
        		idNamesAsSqlCols.push(idNames[i] + ' TEXT NOT NULL');
        		tempTableSelectClause.push(idAlias + '.id_val AS ' + idNames[i]);
        		tempTableJoinClauses.push('LEFT OUTER JOIN new_elem_ids ' + idAlias + ' ON ' +
					'e.table_name = "' + tableName + '" AND ' +
					'e.change_id = ' + idAlias + '.change_id AND ' +
					idAlias + '.id_order = ' + i);
        		idsMatchJoinClause.push('ids.' + idNames[i] + ' = data.' + idNames[i]);
        	}
			//Create a temporary table, with a column for each id of this table.
        	self._executeSql('CREATE TEMPORARY TABLE ' + tempTableName + ' (' + self._arrayToString(idNamesAsSqlCols, ', ') + ');', [], tx);
        	//Fill this temporary table. Each row in this temp table is a unique combination of ids identifying a record that was inserted into or updated
			//in the current table since the last sync. The join clauses here are basically a makeshift pivot on the new_elem table
        	self._executeSql('INSERT INTO ' + tempTableName + ' SELECT DISTINCT ' + self._arrayToString(tempTableSelectClause, ', ') +
				' FROM new_elem e ' + self._arrayToString(tempTableJoinClauses, ' '), [], tx);
			//Select every element in the current table whose unique combination of ids matches a unique combination in the temp table
        	sql = 'SELECT data.* FROM ' + tableName + ' data INNER JOIN ' + tempTableName + ' ids ON ' + self._arrayToString(idsMatchJoinClause, ' AND ');
        	self._selectSql(sql, tx, function (data) {
        		//Drop the temp table
        		self._executeSql('DROP TABLE ' + tempTableName);
        		//Execute the callback function
        		dataCallBack(data);
        	});
        }
    	//self._selectSql(sql, tx, dataCallBack);
       
    },


    _sendDataToServer: function(dataToSync, callBack) {
        var self = this;

        var XHR = new window.XMLHttpRequest(),
                data = JSON.stringify({ "clientData": JSON.stringify(dataToSync) });
        XHR.overrideMimeType = 'application/json;charset=UTF-8';
        XHR.open("POST", self.serverUrl, true);
        XHR.setRequestHeader("Content-type", "application/json; charset=utf-8");
        XHR.onreadystatechange = function () {
            var serverAnswer;
            if(4 === XHR.readyState) {
                try {
                    serverAnswer = JSON.parse(XHR.responseText);
                } catch(e) {
                    serverAnswer = XHR.responseText;
                }
                self.log('Server answered: ');
                self.log(serverAnswer);
                //I want only json/object as response
                if(XHR.status == 200 && serverAnswer instanceof Object) {
                    callBack(serverAnswer);
                } else {
                    serverAnswer = {
                        result : 'ERROR',
                        status : XHR.status,
                        message : XHR.statusText
                    };
                    callBack(serverAnswer);
                }
            }
        };

        XHR.send(data);

    },

    _updateLocalDb: function(serverData, callBack) {
        var self = this;
        self.serverData = serverData;

        if (!serverData || serverData.result === 'ERROR') {
            self.syncResult.syncOK = false;
            self.syncResult.codeStr = 'syncKoServer';
            if (serverData) {
                self.syncResult.message = serverData.message;
            } else {
                self.syncResult.message = 'No answer from the server';
            }
            self.cbEndSync(self.syncResult);
            return;
        }
        if (typeof serverData.data === 'undefined' || serverData.data.length === 0) {
            //nothing to update
            self.db.transaction(function(tx) {
                //We only use the server date to avoid dealing with wrong date from the client
                self._finishSync(serverData.syncDate, tx, callBack(0));
            });
            return;
        }
        self.db.transaction(function(tx) {
            var counterNbTable = 0, nbTables = self.tablesToSync.length;
            var counterNbElm = 0;
            self.tablesToSync.forEach(function(table) {
                var currData = serverData.data[table.tableName];
                if (typeof currData === "undefined") {
                    //Should always be defined (even if 0 elements)
                    currData = [];
                }
                var nb = currData.length;
                counterNbElm += nb;
                self.log('There are ' + nb + ' new or modified elements in the table ' + table.tableName + ' to save in the local DB');

				//Assembles a list of database IDs for each record that is new or modified
                var i = 0, j = 0, listIdToCheck = [];
                for (i = 0; i < nb; i++) {
                	var idsForModifiedRecord = [];
                	for (j = 0; j < table.idNames.length; j++) {
                		idsForModifiedRecord.push(serverData.data[table.tableName][i][table.idNames[j]]);
                	}
                	listIdToCheck.push(idsForModifiedRecord);
                }
                
                self._getIdExitingInDB(table.tableName, table.idNames, listIdToCheck, tx, function(idsInDb) {
                    
                    var curr = null, sql = null;

                    for (i = 0; i < nb; i++) {

						//Assemble IDs of current record into an array
                        curr = serverData.data[table.tableName][i];
                        var currIds = [];
                        for (var idIndex = 0; idIndex < table.idNames.length; idIndex++) {
                        	currIds.push(curr[table.idNames[idIndex]]);
                        }

                        if (self._getIsInDb(currIds, idsInDb)) { // update
                            
                            /*ex : UPDATE "tableName" SET colonne 1 = [valeur 1], colonne 2 = [valeur 2]*/
                        	sql = self._buildUpdateSQL(table.tableName, curr);
							//Append where clause to select right row to update (ex : WHERE id1 = "1" AND id2 = "a")
                        	var whereClausePieces = [];
                        	for (var idIndex = 0; idIndex < table.idNames.length; idIndex++) {
                        		whereClausePieces.push(table.idNames[idIndex] + ' = "' + curr[table.idNames[idIndex]] + '"');
                        	}
                        	sql += ' WHERE ' + self._arrayToString(whereClausePieces, ' AND ');

                            self._executeSql(sql, [], tx);

                        } else {//insert
                            //'ex INSERT INTO tablename (id, name, type, etc) VALUES (?, ?, ?, ?);'
                            var attList = self._getAttributesList(curr);
                            sql = self._buildInsertSQL(table.tableName, curr, attList);
                            var attValue = self._getMembersValue(curr, attList);

                            self._executeSql(sql, attValue, tx);
                        }
                    }//end for
                    counterNbTable++;
                    if (counterNbTable === nbTables) {
                        //TODO set counterNbElm to info
                        self.syncResult.nbUpdated = counterNbElm;
                        self._finishSync(serverData.syncDate, tx, callBack);
                    }
                });//end getExisting Id
            });//end forEach
        });//end tx
    },
    /** return the listIdToCheck curated from the id that doesn't exist in tableName and idNames
     * (used in the DBSync class to know if we need to insert new elem or just update)
     * @param {Object} tableName : card_stat.
     * @param {Object} idNames : ex. card_id.
     * @param {Object} listIdToCheck : ex. [10000, 10010].
     * @param {Object} dataCallBack(listIdsExistingInDb[id] === true).
     */
    _getIdExitingInDB: function(tableName, idNames, listIdToCheck, tx, dataCallBack) {
        if (listIdToCheck.length === 0) {
            dataCallBack([]);
            return;
        }
        var self = this;

    	//See this stackoverflow answer for reference on query structure: http://stackoverflow.com/a/11171387/2363561
    	//(using inline table, pair is unique)
        var selectIdNames = [];
        for (var i = 0; i < idNames.length; i++) {
        	selectIdNames.push(tableName + "." + idNames[i]);
        }

        var selectClauses = [];
        for (var i = 0; i < listIdToCheck.length; i++) {
        	var idList = [];
        	for (var j = 0; j < idNames.length; j++) {
        		idList.push('"' + listIdToCheck[i][j] + '" AS ' + idNames[j]);
        	}
        	selectClauses.push('SELECT ' + self._arrayToString(idList, ', '));
        }
        var inlineTable = '(' + self._arrayToString(selectClauses, " UNION ALL ") + ') AS pair';

        var joinOnClauses = [];
        for (var i = 0; i < idNames.length; i++) {
        	joinOnClauses.push('pair.' + idNames[i] + ' = ' + tableName + '.' + idNames[i]);
        }
        var joinOnClause = self._arrayToString(joinOnClauses, ' AND ');

    	//var SQL = 'SELECT ' + self._arrayToString(idNames, ',') + ' FROM ' + tableName + ' WHERE ' + idNames + ' IN ("' + self._arrayToString(listIdToCheck, '","') + '")';
        var SQL = 'SELECT ' + self._arrayToString(selectIdNames, ', ') + ' FROM ' + tableName + ' INNER JOIN ' + inlineTable + ' ON ' + joinOnClause;
        self._selectSql(SQL, tx, function(ids) {
            var idsInDb = [];
            for (var i = 0; i < ids.length; ++i) {
            	var recordIds = [];
            	for (var j = 0; j < idNames.length; j++) {
            		recordIds.push(ids[i][idNames[j]]);
            	}
            	self._setIsInDb(recordIds, idsInDb);
            	//idsInDb[ids[i][idName]] = true;
            }
            dataCallBack(idsInDb);
        });
    },
    _setIsInDb: function(attributeNames, baseObj) {
    	recursiveSetAttribute(0, baseObj);
    	function recursiveSetAttribute(index, obj) {
    		var attribute = attributeNames[index];
    		if (index >= attributeNames.length - 1) {
    			obj[attribute] = true;
    			return;
    		}
    		obj[attribute] = [];
    		recursiveSetAttribute(index + 1, obj[attribute]);
    	}
    },
    _getIsInDb: function (attributeNames, baseObj) {
    	return recursiveGetAttribute(0, baseObj);
    	function recursiveGetAttribute(index, obj) {
    		if (index >= attributeNames.length) {
    			return obj === true;
    		}
    		if (obj === undefined) {
    			return false;
    		}
    		var attribute = attributeNames[index];
    		return recursiveGetAttribute(index + 1, obj[attribute]);
    	}
    },
    _finishSync: function(syncDate, tx, callBack) {
        var self = this, tableName, idsToDelete, idNames, i, idValue, idsString;
        this.firstSync = false;
        this.syncInfo.lastSyncDate = syncDate;
        this._executeSql('UPDATE sync_info SET last_sync = "' + syncDate + '"', [], tx);
		//Currently emptying new_elem tables on sync finish. This means that background syncing is not supported
        this._executeSql('DELETE FROM new_elem_ids');
        this._executeSql('DELETE FROM new_elem');

    	//The below code uses an out of date database schema, but tries to support background syncing. 
        //It has been left as a reference if we decide we want to support background syncing in the future.

        // Remove only the elem sent to the server (in case new_elem has been added during the sync)
    	// CLARIFICATION: This library supports the use case of syncing in the background while the user continues working.
    	// Therefore, if the user has modified their local data since starting the sync, we don't want to remove the corresponding records in new_elem and new_elem_ids
		// This means we have to manually remove all elements sent to or recieved from the server, rather than just emptying the table.
        //for (tableName in self.clientData.data) {
        //	idNames = self.idNamesFromTableName[tableName];
        //	for (var idIndex = 0; idIndex < idNames.length; idIndex++) {
        //		idName = idNames[idIndex];
        //		idsToDelete = new Array();
        //		for (i = 0; i < self.clientData.data[tableName].length; i++) {
        //			idValue = self.clientData.data[tableName][i][idName];
        //			idsToDelete.push('"' + idValue + '"');
        //		}
        //		if (idsToDelete.length > 0) {
        //			idsString = self._arrayToString(idsToDelete, ',');
        //			self._executeSql('DELETE FROM new_elem WHERE table_name = "' + tableName + '" AND id_order=' + idIndex + ' AND id IN (' + idsString + ')', [], tx);
        //		}
        //	}
        //}
        //// Remove elems received from the server that has triggered the SQL TRIGGERS, to avoid to send it again to the server and create a loop
        //for (tableName in self.serverData.data) {
        //	idNames = self.idNamesFromTableName[tableName];
        //	idsToDelete = new Array();
        //	for (var idIndex = 0; idIndex < idNames.length; idIndex++) {
        //		idName = idNames[idIndex];
        //		for (i = 0; i < self.serverData.data[tableName].length; i++) {
        //			idValue = self.serverData.data[tableName][i][idNames];
        //			idsToDelete.push('"' + idValue + '"');
        //		}
        //		if (idsToDelete.length > 0) {
        //			idsString = self._arrayToString(idsToDelete, ',');
        //			self._executeSql('DELETE FROM new_elem WHERE table_name = "' + tableName + '" AND id_order=' + idIndex + ' AND id IN (' + idsString + ')', [], tx);
        //		}
        //	}
        //}

        callBack();
        self.clientData = null;
        self.serverData = null;
    },


/***************** DB  util ****************/

    _selectSql: function(sql, optionalTransaction, callBack) {
        var self = this;
        self._executeSql(sql, [], optionalTransaction, function(tx, rs) {
        callBack(self._transformRs(rs));
        }, self._errorHandler);
    },
    _transformRs: function(rs) {
        var elms = [];
        if (typeof(rs.rows) === 'undefined') {
            return elms;
        }

        for (var i = 0; i < rs.rows.length; ++i) {
            elms.push(rs.rows.item(i));
        }
        return elms;
    },

    _executeSql: function(sql, params, optionalTransaction, optionalCallBack) {
        var self = this;
        self.log('_executeSql: ' + sql + ' with param ' + params);
        if (!optionalCallBack) {
            optionalCallBack = self._defaultCallBack;
        }
        if (optionalTransaction) {
            self._executeSqlBridge(optionalTransaction, sql, params, optionalCallBack, self._errorHandler);
        } else {
            self.db.transaction(function(tx) {
                self._executeSqlBridge(tx, sql, params, optionalCallBack, self._errorHandler);
            });
        }
    },
    _executeSqlBridge: function(tx, sql, params, dataHandler, errorHandler) {
        var self = this;

        //Standard WebSQL
        tx.executeSql(sql, params, dataHandler, errorHandler);

    },

    _defaultCallBack: function(transaction, results) {
        //DBSYNC.log('SQL Query executed. insertId: '+results.insertId+' rows.length '+results.rows.length);
    },

    _errorHandler: function(transaction, error) {
        DBSYNC.error('Error : ' + error.message + ' (Code ' + error.code + ') Transaction.sql = ' + transaction.sql);
    },

    _buildInsertSQL: function(tableName, objToInsert) {
        var members = this._getAttributesList(objToInsert);
        if (members.length === 0) {
            throw 'buildInsertSQL : Error, try to insert an empty object in the table ' + tableName;
        }
        //build INSERT INTO myTable (attName1, attName2) VALUES (?, ?) -> need to pass the values in parameters
        var sql = 'INSERT INTO ' + tableName + ' (';
        sql += this._arrayToString(members, ',');
        sql += ') VALUES (';
        sql += this._getNbValString(members.length, '?', ',');
        sql += ')';
        return sql;
    },

    _buildUpdateSQL: function(tableName, objToUpdate) {
        /*ex UPDATE "nom de table" SET colonne 1 = [valeur 1], colonne 2 = [valeur 2] WHERE {condition}*/
        var self = this;
        var sql = 'UPDATE ' + tableName + ' SET ';
        var members = self._getAttributesList(objToUpdate);
        if (members.length === 0) {
            throw 'buildUpdateSQL : Error, try to insert an empty object in the table ' + tableName;
        }
        var values = self._getMembersValue(objToUpdate, members);

        var nb = members.length;
        for (var i = 0; i < nb; i++) {
            sql += '"' + members[i] + '" = "' + values[i] + '"';
            if (i < nb - 1) {
                sql += ', ';
            }
        }

        return sql;
    },
    _getMembersValue: function(obj, members) {
        var memberArray = [];
        for (var i = 0; i < members.length; i++) {
            memberArray.push(obj[members[i]]);
        }
        return memberArray;
    },
    _getAttributesList: function(obj, check) {
        var memberArray = [];
        for (var elm in obj) {
            if (check && typeof this[elm] === 'function' && !obj.hasOwnProperty(elm)) {
                continue;
            }
            memberArray.push(elm);
        }
        return memberArray;
    },
    _getNbValString: function(nb, val, separator) {
        var result = '';
        for (var i = 0; i < nb; i++) {
            result += val;
            if (i < nb - 1) {
                result += separator;
            }
        }
        return result;
    },
    _getMembersValueString: function(obj, members, separator) {
        var result = '';
        for (var i = 0; i < members.length; i++) {
            result += '"' + obj[members[i]] + '"';
            if (i < members.length - 1) {
                result += separator;
            }
        }
        return result;
    },
    _arrayToString: function(array, separator) {
        var result = '';
        for (var i = 0; i < array.length; i++) {
            result += array[i];
            if (i < array.length - 1) {
                result += separator;
            }
        }
        return result;
    }
};

return DBSYNC;

}));
