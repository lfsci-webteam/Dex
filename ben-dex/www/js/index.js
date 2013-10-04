var TYPES = {
	"None": 0,
	"Normal": 1, "Fighting": 2, "Flying": 3, "Poison": 4, "Ground": 5, "Rock": 6, "Bug": 7, "Ghost": 8, "Steel": 9,
	"Fire": 10, "Water": 11, "Grass": 12, "Electric": 13, "Psychic": 14, "Ice": 15, "Dragon": 16, "Dark": 17, "Fairy": 18
};

var app = {

    // Application Constructor
    initialize: function() {
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
    onDeviceReady: function() {
    	app.loadPokemonList();
    },
	
    loadPokemonList: function() {
    	var allPokemon = app.dataSource.getAllPokemon();
    	$("#ulPokedexList").empty();
    	for (i = 0; i <= 151; i++) {
    		if (allPokemon[i]) {
    			var pkmn = allPokemon[i];
    			var itemString = "<li><a href='#pkmnDetails' onclick='app.loadPokemonInfo(" + pkmn.id + ")'>" + formatPkmnNumber(pkmn.id) + " " + pkmn.name + "</a></li>";
    			$("#ulPokedexList").append(itemString);
    		}
    	}
    	$("#ulPokedexList").listview("refresh");
    },

    blankPokemonInfo: function() {
    	$("#divPkmnId").show().val("");
    	$("#divPkmnName").show().val("");
    	$("#hidCurPkmnId").val("");
    	$("#pkmnNameHeader").html("New Entry");
    	$("#txtSpecies").val("");
    	this.loadTypes(TYPES.Normal, TYPES.None);
    },

    loadPokemonInfo: function(pkmnId) {
    	var pkmnInfo = this.dataSource.getPokemonInfo(pkmnId);
    	$("#divPkmnId").hide();
    	$("#divPkmnName").hide();
    	$("#hidCurPkmnId").val(pkmnInfo.id);
    	$("#pkmnNameHeader").html(formatPkmnNumber(pkmnId) + " - " + pkmnInfo.name);
    	$("#txtSpecies").val(pkmnInfo.species);
    	this.loadTypes(pkmnInfo.type1, pkmnInfo.type2);
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
    	var pkmnInfoToUpdate;
    	if (pkmnId == "") {
    		pkmnInfoToUpdate = {};
    		pkmnInfoToUpdate.id = $("#txtPkmnId").val();
    		pkmnInfoToUpdate.name = $("#txtPkmnName").val();
    	}
    	else {
    		pkmnInfoToUpdate = this.dataSource.getPokemonInfo(pkmnId);
    		//Names and ids are currently immutable once added
    	}
    	pkmnInfoToUpdate.species = $("#txtSpecies").val();
    	pkmnInfoToUpdate.type1 = $("#selectType1").val();
    	pkmnInfoToUpdate.type2 = $("#selectType2").val();
    	this.dataSource.savePokemonInfo(pkmnInfoToUpdate);
    	this.loadPokemonList();
    },
	
    dataSource: {
		
    	getAllPokemon: function () {
    		return this.tempDb;
    	},

    	getPokemonInfo: function (pkmnId) {
    		return this.tempDb[pkmnId];
    	},

    	savePokemonInfo: function (pkmnInfo) {
    		this.tempDb[pkmnInfo.id] = pkmnInfo;
    	},

    	tempDb: {
    		2: {
				id: 2,
				name: "Ivysaur",
				species: "Seed",
    			type1: TYPES.Grass,
				type2: TYPES.Poison
    		},
    		6: {
    			id: 6,
    			name: "Charizard",
				species: "Flame",
				type1: TYPES.Fire,
				type2: TYPES.Flying
			},
    		7: {
    			id: 7,
    			name: "Squirtle",
				species: "Tiny Turtle",
				type1: TYPES.Water,
				type2: TYPES.None
			},
    		33: {
    			id: 33,
    			name: "Nidorino",
				species: "Poison Pin",
				type1: TYPES.Poison,
				type2: TYPES.None
			},
    		104: {
    			id: 104,
    			name: "Cubone",
				species: "Lonely",
				type1: TYPES.Ground,
				type2: TYPES.None
			},
    		135: {
    			id: 135,
    			name: "Jolteon",
				species: "Lightning",
				type1: TYPES.Electric,
				type2: TYPES.None
			}
    	}

    }


};

function formatPkmnNumber(num) {
	var result = num + '';
	while (result.length < 3) {
		result = '0' + result;
	}
	return "#" + result;
}