/// <reference path="jquery.js" />
/// <reference path="jquery.linq.js" />

var TYPES = {
	"None": 0,
	"Normal": 1, "Fighting": 2, "Flying": 3, "Poison": 4, "Ground": 5, "Rock": 6, "Bug": 7, "Ghost": 8, "Steel": 9,
	"Fire": 10, "Water": 11, "Grass": 12, "Electric": 13, "Psychic": 14, "Ice": 15, "Dragon": 16, "Dark": 17, "Fairy": 18
};

var app = {

	// Application Constructor
	initialize: function () {
		this.bindEvents();
	},
	
	// Bind Event Listeners
	//
	// Bind any events that are required on startup. Common events are:
	// 'load', 'deviceready', 'offline', and 'online'.
	bindEvents: function() {
		document.addEventListener('deviceready', this.onDeviceReady, false);
	},
	
	// deviceready Event Handler
	//
	// The scope of 'this' is the event. In order to call the 'receivedEvent'
	// function, we must explicity call 'app.receivedEvent(...);'
	onDeviceReady: function () {
		app.dataSource.initialize(app.loadPokemonList);
	},
	
	loadPokemonList: function () {
		app.dataSource.getAllPokemon(getAllReturn);

		function getAllReturn(tx, results) {
			var allPokemon = app.dataSource.sqlResultToEnumerable(results).OrderBy("$.id");
			var list = $("#ulPokedexList");

			list.empty();
			allPokemon.ForEach(function (pkmn) {
				var mainLinkString = "<a href='#pkmnDetails' data-transition='fade' onclick='app.loadPokemonInfo(" + pkmn.id + ")'>" +
					formatPkmnNumber(pkmn.id) + " " + pkmn.name + "</a>";
				var specimensLinkString = "<a href='#specimenList' data-transition='slidefade' onclick='app.loadSpecimenList(" + pkmn.id + ")'>Specimens</a>";
				list.append("<li>" + mainLinkString + specimensLinkString + "</li>");
			});
			list.listview("refresh");
		}
	},

	blankPokemonInfo: function () {
		$("#divPkmnId").show();
		$("#divPkmnName").show();
		$("#cryRecordContainer").hide();
		$("#txtPkmnId").val("");
		$("#txtPkmnName").val("");
		$("#hidCurPkmnId").val("");
		$("#pkmnNameHeader").html("New Entry");
		$("#txtSpecies").val("");
		app.loadTypes(TYPES.Normal, TYPES.None);
	},

	loadPokemonInfo: function (pkmnId) {
		app.dataSource.getPokemonInfo(pkmnId, getPkmnInfoReturn);

		function getPkmnInfoReturn(tx, results) {
			var pkmnInfo = app.dataSource.sqlResultToEnumerable(results).Single();
			$("#divPkmnId").hide();
			$("#divPkmnName").hide();
			$("#cryRecordContainer").show();
			$("#hidCurPkmnId").val(pkmnInfo.id);
			$("#pkmnNameHeader").html(formatPkmnNumber(pkmnInfo.id) + " - " + pkmnInfo.name);
			$("#txtSpecies").val(pkmnInfo.species);
			app.loadTypes(pkmnInfo.type1, pkmnInfo.type2);
			if (pkmnInfo.cryFilePath) {
				$("#btnPlayCry").show();
				audioContext.currentFilename = pkmnInfo.cryFilePath;
			}
			else 
				$("#btnPlayCry").hide();
		}
	},

	loadTypes: function (type1, type2) {
		var dropDown1 = $("#selectType1");
		var dropDown2 = $("#selectType2");
		dropDown1.empty();
		dropDown2.empty();
		$.each(TYPES, function (key, value) {
			var strOption = "<option value='" + value + "'>" + key + "</option>";
			if (value != TYPES.None) //"None" is not an option for type 1
				dropDown1.append(strOption);
			dropDown2.append(strOption);
		});
		$("#selectType1 option[value='" + type1 + "']").prop('selected', true);
		$("#selectType2 option[value='" + type2 + "']").prop('selected', true);
		dropDown1.selectmenu();
		dropDown1.selectmenu('refresh', true);
		dropDown2.selectmenu();
		dropDown2.selectmenu('refresh', true);
	},

	savePokemonInfo: function() {
		var pkmnId = $("#hidCurPkmnId").val();
		var pkmnInfoToUpdate = {};
		var isInsert = pkmnId == "";
		if (isInsert) {
			pkmnInfoToUpdate.id = $("#txtPkmnId").val();
			pkmnInfoToUpdate.name = $("#txtPkmnName").val();
		}
		else {
			pkmnInfoToUpdate.id = pkmnId; //This is so we know what row to update
			//No point assigning a name, since names are immutable
		}
		pkmnInfoToUpdate.species = $("#txtSpecies").val();
		pkmnInfoToUpdate.type1 = $("#selectType1").val();
		pkmnInfoToUpdate.type2 = $("#selectType2").val();
		if (isInsert)
			app.dataSource.insertPokemonInfo(pkmnInfoToUpdate, app.loadPokemonList);
		else
			app.dataSource.updatePokemonInfo(pkmnInfoToUpdate, app.loadPokemonList);
	},

	loadSpecimenList: function (pkmnId) {
		$("#hidCurSpeciesForSpecimens").val(pkmnId);
		//$("#mapLink").attr('href', "map.html?speciesId=" + pkmnId);
		app.dataSource.getAllSpecimensOfSpecies(pkmnId, loadSpecimenListReturn);
		app.dataSource.getPokemonInfo(pkmnId, loadSpeciesName);

		function loadSpecimenListReturn(tx, results) {
			var allSpecimens = app.dataSource.sqlResultToEnumerable(results);
			var list = $("#ulSpecimenList");

			list.empty();
			allSpecimens.ForEach(function (specimen) {
				list.append("<li><a href='#specimenDetails' data-transition='fade' onclick='app.loadSpecimenInfo(" + specimen.id + ")'>" +
					specimen.nickname + " Lv " + specimen.level + "</a></li>");
			});
			list.listview("refresh");
		}

		function loadSpeciesName(tx, results) {
			var pkmnInfo = app.dataSource.sqlResultToEnumerable(results).Single();
			$("#specimenListHeader").html(pkmnInfo.name);
			$("#specimenDetailsHeader").html(pkmnInfo.name);
		}
	},
		
	blankSpecimenInfo: function() {
		$("#divLocation").hide();
		$("#hidCurSpecimenId").val("");
		$("#txtNickname").val("");
		$("#toggleGender").val("male");
		$("#levelSlider").val("5")//.slider("refresh"); //TODO
		
	},

	loadSpecimenInfo: function (specimenId) {
		app.dataSource.getSpecimenInfo(specimenId, loadSpecimenInfoReturn);

		function loadSpecimenInfoReturn(tx, results) {
			var specimenInfo = app.dataSource.sqlResultToEnumerable(results).Single();
			$("#hidCurSpecimenId").val(specimenInfo.id);
			$("#txtNickname").val(specimenInfo.nickname);
			$("#toggleGender").val(specimenInfo.gender).slider("refresh");
			$("#levelSlider").val(specimenInfo.level).slider("refresh");
			if (specimenInfo.latitude && specimenInfo.longitude) {
				$("#divLocation").show();
				$("#hidLatitude").val(specimenInfo.latitude);
				$("#hidLongitude").val(specimenInfo.longitude);
				$("#spanLatitude").html(specimenInfo.latitude.toFixed(6));
				$("#spanLongitude").html(specimenInfo.longitude.toFixed(6));
			}
			else {
				$("#divLocation").hide();
				$("#hidLatitude").val("");
				$("#hidLongitude").val("");
				$("#spanLatitude").html("");
				$("#spanLongitude").html("");
			}
		}
	},

	saveSpecimenInfo: function () {
		var specimenId = $("#hidCurSpecimenId").val();
		var specimenInfoToUpdate = {};
		var isInsert = specimenId == "";
		if (isInsert) {
			specimenInfoToUpdate.speciesId = $("#hidCurSpeciesForSpecimens").val();
		}
		else {
			specimenInfoToUpdate.id = specimenId;
		}
		specimenInfoToUpdate.nickname = $("#txtNickname").val();
		specimenInfoToUpdate.gender = $("#toggleGender").val();
		specimenInfoToUpdate.level = $("#levelSlider").val();
		specimenInfoToUpdate.latitude = $("#hidLatitude").val();
		if (specimenInfoToUpdate.latitude == "")
			specimenInfoToUpdate.latitude = null;
		specimenInfoToUpdate.longitude = $("#hidLongitude").val();
		if (specimenInfoToUpdate.longitude == "")
			specimenInfoToUpdate.longitude = null;

		if (isInsert)
			app.dataSource.insertSpecimen(specimenInfoToUpdate, saveSpecimenCallback);
		else
			app.dataSource.updateSpecimen(specimenInfoToUpdate, saveSpecimenCallback);

		function saveSpecimenCallback(tx, results) {
			app.loadSpecimenList($("#hidCurSpeciesForSpecimens").val());
		}
	},

	// GPS

	setSpecimenLocation: function () {
		app.makeModal();
		$.mobile.loading("show");
		navigator.geolocation.getCurrentPosition(gpsSuccess, gpsError);
		
		function gpsSuccess(position) {
			$.mobile.loading("hide");
			app.endModal();
			$("#divLocation").show();
			$("#hidLatitude").val(position.coords.latitude);
			$("#hidLongitude").val(position.coords.longitude);
			$("#spanLatitude").html(position.coords.latitude.toFixed(6));
			$("#spanLongitude").html(position.coords.longitude.toFixed(6));
		}

		function gpsError(error) {
			$.mobile.loading("hide");
			app.endModal();
			console.log("GPS Error: " + error.message);
			var errorType = "Unknown GPS Error";
			if (error.code == PositionError.PERMISSION_DENIED)
				errorType = "GPS Permission denied.";
			else if (error.code == PositionError.POSITION_UNAVAILABLE)
				errorType = "GPS position is unavailable.";
			else if (error.code == PositionError.TIMEOUT)
				errorType = "GPS Timeout.";

			alert(errorType + "\n" + error.message);
		}
	},

	// Audio

	startRecordingCry: function() {
		app.makeModal($(".ui-popup-container"));
		var pkmnId = $("#hidCurPkmnId").val();
		app.dataSource.getPokemonInfo(pkmnId, startRecordingCryDbReturn);
		function startRecordingCryDbReturn(tx, results) {
			var pkmnInfo = app.dataSource.sqlResultToEnumerable(results).Single();
			var filename = padPkmnNumber(pkmnId) + " " + pkmnInfo.name + " Cry." + audioContext.getFileExtension();
			var filepath = "Dex/Cries/" + filename;
			audioContext.startRecording(filename);
		}
	},

	stopRecordingCry: function () {
		app.endModal();
		audioContext.stopRecording();
		//Save filename into database (for now, assuming recording always succeeds)
		var pkmnId = $("#hidCurPkmnId").val();
		app.dataSource.updatePokemonCry(pkmnId, audioContext.currentFilename, filePathSaved);
		function filePathSaved(tx, results) {
			$("#btnPlayCry").show();
		}
	},

	playCry: function() {
		audioContext.playRecording();
	},

	// Modal

	makeModal: function (topElement) {
		if (topElement)
			topElement.addClass("aboveModal");
		$("body").append('<div class="modalWindow"/>');
	},

	endModal: function(topElement) {
		$(".aboveModal").removeClass("aboveModal");
		$(".modalWindow").remove();
	},

	// Database

	dataSource: {
		db: null,

		initialize: function (callback) {
			db = window.openDatabase("Dex", "1.0", "DexDb", 1000000); //1 MB database

			function createTables(tx) {
				//tx.executeSql("DROP TABLE IF EXISTS PkmnSpecies");
				tx.executeSql("CREATE TABLE IF NOT EXISTS PkmnSpecies(id INT PRIMARY KEY NOT NULL, name CHAR(50) NOT NULL, species CHAR(70) NOT NULL, type1 INT NOT NULL, type2 INT, cryFilePath CHAR(200))");

				tx.executeSql("ALTER TABLE PkmnSpecies ADD COLUMN cryFilePath CHAR(200)");

				//$.Enumerable.From(initDb).ForEach(function (pkmn) {
				//	tx.executeSql("INSERT INTO PkmnSpecies (id, name, species, type1, type2) VALUES (" + pkmn.id + ", \"" + pkmn.name + "\", \"" + pkmn.species +
				//		"\", " + pkmn.type1 + ", " + pkmn.type2 + ")");
				//});

				//tx.executeSql("DROP TABLE Specimens");
				tx.executeSql("CREATE TABLE IF NOT EXISTS Specimens(id INTEGER PRIMARY KEY NOT NULL, speciesId INT NOT NULL, nickname CHAR(50) NOT NULL, " +
					"gender CHAR(10) NOT NULL, level INT NOT NULL, latitude REAL, longitude REAL, FOREIGN KEY(speciesId) REFERENCES PkmnSpecies(id))");

				tx.executeSql('UPDATE PkmnSpecies SET cryFilePath = ""'); //For now, clear cry file paths each load
			}

			db.transaction(createTables, this.dbError, callback);
		},

		getAllPokemon: function (callback) {
			function selectAll(tx) {
				tx.executeSql('SELECT name, id FROM PkmnSpecies', [], callback);
			}

			db.transaction(selectAll, this.dbError);
		},

		getPokemonInfo: function (pkmnId, callback) {
			function selectSinglePkmn(tx) {
				var query = 'SELECT * FROM PkmnSpecies WHERE id = ?';
				tx.executeSql(query, [pkmnId], callback); 
			}
			db.transaction(selectSinglePkmn, this.dbError);
		},

		insertPokemonInfo: function (pkmnInfo, callback) {
			function insertPokemon(tx) {
				//TODO: Redundancy with database reset?
				var query = "INSERT INTO PkmnSpecies (id, name, species, type1, type2, cryFilePath) VALUES (?, ?, ?, ?, ?, NULL)";
				tx.executeSql(query, [pkmnInfo.id, pkmnInfo.name, pkmnInfo.species, pkmnInfo.type1, pkmnInfo.type2], callback);
			}
			db.transaction(insertPokemon, this.dbError);
		},

		updatePokemonInfo: function (pkmnInfo, callback) {
			function updatePokemon(tx) {
				//Since pokemon names and ids are immutable, they are not included in the update clause of the query
				//However, the input pkmnInfo object still needs to have an id, so we know which row to update
				var query = 'UPDATE PkmnSpecies SET species=?, type1=?, type2=? WHERE id=?';
				tx.executeSql(query, [pkmnInfo.species, pkmnInfo.type1, pkmnInfo.type2, pkmnInfo.id], callback);
			}
			db.transaction(updatePokemon, this.dbError);
		},

		updatePokemonCry: function(pkmnId, cryFilePath, callback) {
			function updateCry(tx) {
				var query = 'UPDATE PkmnSpecies SET cryFilePath=? WHERE id=?';
				tx.executeSql(query, [cryFilePath, pkmnId], callback);
			}
			db.transaction(updateCry, this.dbError);
		},

		getAllSpecimensOfSpecies: function (speciesId, callback) {
			function transactionFunction(tx) {
				var query = 'SELECT * FROM Specimens WHERE speciesId = ?';
				tx.executeSql(query, [speciesId], callback);
			}
			db.transaction(transactionFunction, this.dbError);
		},

		getSpecimenInfo: function (specimenId, callback) {
			function transactionFunction(tx) {
				var query = 'SELECT * FROM Specimens WHERE id = ?';
				tx.executeSql(query, [specimenId], callback);
			}
			db.transaction(transactionFunction, this.dbError);
		},

		insertSpecimen: function (specimenInfo, callback) {
			function insertTransaction(tx) {
				var query = "INSERT INTO Specimens (speciesId, nickname, gender, level, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)";
				tx.executeSql(query, [specimenInfo.speciesId, specimenInfo.nickname, specimenInfo.gender, specimenInfo.level, specimenInfo.latitude,
					specimenInfo.longitude], callback);
			}
			db.transaction(insertTransaction, this.dbError);
		},

		updateSpecimen: function (specimenInfo, callback) {
			function updateTransaction(tx) {
				var query = "UPDATE Specimens SET nickname=?, gender=?, level=?, latitude=?, longitude=? WHERE id=?";
				tx.executeSql(query, [specimenInfo.nickname, specimenInfo.gender, specimenInfo.level, specimenInfo.latitude, specimenInfo.longitude, specimenInfo.id],
					callback);
			}
			db.transaction(updateTransaction, this.dbError);
		},

    	dbError: function (error) {
    		alert("Database Error! (see console)");
    		console.log("Code: " + error.code + " Message: " + error.message);
    	},

    	sqlResultToEnumerable: function (sqlResult) {
    		var result = new Array();
    		for (var i = 0; i < sqlResult.rows.length; i++) {
    			var temp = sqlResult.rows.item(i);
    			result[i] = sqlResult.rows.item(i);
    		}
    		return $.Enumerable.From(result);
    	}

    },

};

function padPkmnNumber(num) {
	var result = num + '';
	while (result.length < 3) {
		result = '0' + result;
	}
	return result;
}

function formatPkmnNumber(num) {
	var result = padPkmnNumber(num);
	return "#" + result;
}

var initDb = [
	{
		id: 2,
		name: "Ivysaur",
		species: "Seed",
		type1: TYPES.Grass,
		type2: TYPES.Poison
	},
	{
		id: 6,
		name: "Charizard",
		species: "Flame",
		type1: TYPES.Fire,
		type2: TYPES.Flying
	},
	{
		id: 7,
		name: "Squirtle",
		species: "Tiny Turtle",
		type1: TYPES.Water,
		type2: TYPES.None
	},
	{
		id: 33,
		name: "Nidorino",
		species: "Poison Pin",
		type1: TYPES.Poison,
		type2: TYPES.None
	},
	{
		id: 104,
		name: "Cubone",
		species: "Lonely",
		type1: TYPES.Ground,
		type2: TYPES.None
	},
	{
		id: 135,
		name: "Jolteon",
		species: "Lightning",
		type1: TYPES.Electric,
		type2: TYPES.None
	}
];