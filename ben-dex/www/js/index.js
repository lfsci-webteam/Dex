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

    		$("#ulPokedexList").empty();
    		allPokemon.ForEach(function (pkmn) {
    			var itemString = "<li><a href='#pkmnDetails' onclick='app.loadPokemonInfo(" + pkmn.id + ")'>" + formatPkmnNumber(pkmn.id) + " " + pkmn.name + "</a></li>";
    			$("#ulPokedexList").append(itemString);
    		});
    		$("#ulPokedexList").listview("refresh");
    	}
    },

    blankPokemonInfo: function () {
    	$("#divPkmnId").show().val("");
    	$("#divPkmnName").show().val("");
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
    		$("#hidCurPkmnId").val(pkmnInfo.id);
    		$("#pkmnNameHeader").html(formatPkmnNumber(pkmnInfo.id) + " - " + pkmnInfo.name);
    		$("#txtSpecies").val(pkmnInfo.species);
    		app.loadTypes(pkmnInfo.type1, pkmnInfo.type2);
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
	
    dataSource: {
    	db: null,

    	initialize: function (callback) {
    		db = window.openDatabase("Dex", "1.0", "DexDb", 1000000); //1 MB database

    		function createTables(tx) {
    			//tx.executeSql("DROP TABLE IF EXISTS PkmnSpecies");
    			tx.executeSql("CREATE TABLE IF NOT EXISTS PkmnSpecies(id INT PRIMARY KEY NOT NULL, name CHAR(50) NOT NULL, species CHAR(70) NOT NULL, type1 INT NOT NULL, type2 INT)");

    			//$.Enumerable.From(initDb).ForEach(function (pkmn) {
    			//	tx.executeSql("INSERT INTO PkmnSpecies (id, name, species, type1, type2) VALUES (" + pkmn.id + ", \"" + pkmn.name + "\", \"" + pkmn.species +
				//		"\", " + pkmn.type1 + ", " + pkmn.type2 + ")");
    			//});
    		}

    		db.transaction(createTables, this.dbError, callback);
    	},

    	getAllPokemon: function (callback) {
    		function selectAll(tx) {
    			tx.executeSql('SELECT * FROM PkmnSpecies', [], callback);
    		}

    		db.transaction(selectAll, this.dbError);
    	},

    	getPokemonInfo: function (pkmnId, callback) {
    		function selectSinglePkmn(tx) {
    			var query = 'SELECT * FROM PkmnSpecies WHERE id = ?';
    			console.log(query);
    			tx.executeSql(query, [pkmnId], callback); 
    		}
    		db.transaction(selectSinglePkmn, this.dbError);
    	},

    	insertPokemonInfo: function (pkmnInfo, callback) {
    		function insertPokemon(tx) {
    			//TODO: Redundancy with database reset?
    			var query = "INSERT INTO PkmnSpecies (id, name, species, type1, type2) VALUES (?, ?, ?, ?, ?)";
    			console.log(query);
    			tx.executeSql(query, [pkmnInfo.id, pkmnInfo.name, pkmnInfo.species, pkmnInfo.type1, pkmnInfo.type2], callback);
    		}
    		db.transaction(insertPokemon, this.dbError);
    	},

    	updatePokemonInfo: function (pkmnInfo, callback) {
    		function updatePokemon(tx) {
    			//Since pokemon names and ids are immutable, they are not included in the update clause of the query
				//However, the input pkmnInfo object still needs to have an id, so we know which row to update
    			var query = 'UPDATE PkmnSpecies SET species=?, type1=?, type2=? WHERE id=?';
    			console.log(query);
    			tx.executeSql(query, [pkmnInfo.species, pkmnInfo.type1, pkmnInfo.type2, pkmnInfo.id], callback);
    		}
    		db.transaction(updatePokemon, this.dbError);
    	},

    	dbError: function (error) {
    		alert("Database Error!\n" + error.code + "\n" + error.message);
    	},

    	sqlResultToEnumerable: function (sqlResult) {
    		var result = new Array();
    		console.log("Raw results:");
    		for (var i = 0; i < sqlResult.rows.length; i++) {
    			var temp = sqlResult.rows.item(i);
    			console.log("#" + temp.id + " " + temp.name + " " + temp.species + " " + temp.type1 + " " + temp.type2);
    			result[i] = sqlResult.rows.item(i);
    		}
    		return $.Enumerable.From(result);
    	}

    },


    oldDataSource: {
		
    	initialize: function () {
    		if(!window.localStorage.pokedexSpecies)
	    		window.localStorage.pokedexSpecies = JSON.stringify(initDb);
    	},

    	getAllPokemon: function () {
    		return $.Enumerable.From(JSON.parse(window.localStorage.pokedexSpecies));
    	},

    	getPokemonInfo: function (pkmnId) {
    		return this.getAllPokemon().Single("$.id==" + pkmnId);
    	},

    	savePokemonInfo: function (pkmnInfo) {
    		var allPokemon = this.getAllPokemon();
    		var speciesArray = allPokemon.ToArray();
    		var oldPkmnInfo = allPokemon.SingleOrDefault(null, "$.id==" + pkmnInfo.id);
    		if (oldPkmnInfo == null) {
    			speciesArray.push(pkmnInfo);
    		}
    		else {
    			var oldPkmnInfoIndex = allPokemon.IndexOf(oldPkmnInfo);
    			speciesArray[oldPkmnInfoIndex] = pkmnInfo;
    		}

    		window.localStorage.pokedexSpecies = JSON.stringify(speciesArray);
    	},

    }


};

function formatPkmnNumber(num) {
	var result = num + '';
	while (result.length < 3) {
		result = '0' + result;
	}
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