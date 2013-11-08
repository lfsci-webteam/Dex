$(document).on('pageshow', '#mainMap', function (e, data) {
	if (IsOnline()) {
		$("#offlineMessage").hide();
		$("#map_canvas").show();
		mapContext.initMap();
		mapContext.placeMarkers();
	}
	else {
		$("#offlineMessage").show();
		$("#map_canvas").hide();
	}
});

var mapContext = {
	map: null,
	markers: [],

	initMap: function () {
		var mapOptions = {
			zoom: 3,
			center: new google.maps.LatLng(40, -98),
			mapTypeId: google.maps.MapTypeId.ROADMAP
		}

		this.map = new google.maps.Map(document.getElementById("map_canvas"), mapOptions);
	},

	placeMarkers: function () {
		markers = [];
		pkmnId = $("#hidCurSpeciesForSpecimens").val();
		app.dataSource.getAllSpecimensOfSpecies(pkmnId, placeMarkersReturn);

		function placeMarkersReturn(tx, results) {
			var allSpecimens = app.dataSource.sqlResultToEnumerable(results);
			var zoomBounds = new google.maps.LatLngBounds();
			allSpecimens.ForEach(function (specimen) {
				var coordinates = new google.maps.LatLng(specimen.latitude, specimen.longitude);
				var curMarker = new google.maps.Marker({
					position: coordinates,
					map: mapContext.map,
				});
				markers.push(curMarker);
				zoomBounds.extend(coordinates);
			});
			mapContext.map.fitBounds(zoomBounds);
		}

	},
};

function IsOnline() {
	return !(navigator.network.connection.type == Connection.NONE || navigator.network.connection.type == Connection.UNKNOWN);
}