function relog(xhr) {
	// Decide to relog on auth failure
	// 401 = unauth, 403 = expired
	if (xhr.status == 401 || xhr.status == 403) {
		window.location = "https://connected-corridors.berkeley.edu/tool";
	};
}

function setIndicator(target, state) {
	target.removeClass('idle fail busy complete');
	target.addClass(state);
};

var Selector = {
	'settings': {
		'home': [34.146752, -118.029146],
		'homeZoom': 12
	},
	// {{{ Icons
	'errorIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'emptyIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'untrackedIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'peerlessIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'standardIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'edgeIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),

	'unknownIcon': L.icon({
		iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
		shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',

		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],
		shadowSize: [41, 41],
		shadowAnchor: [12, 41]	// the same for the shadow
	}),
	// }}}	

	'selectedMarker': L.circleMarker([null, null], {
		color: '#5577aa',
		opacity: 0.8,
		radius: 10
	}),

	'tagStates': [
		'.unobserved',
		'.unknown',
		'.peerless',
		'.untracked',
		'.singleton',
		'.miscounting',
		'.clear'
	],

	'getFATVs': function() {
		var self = this;
		this.fatvs = {};
		var target = root_api + 'info/fatvs' + '?date=' + window.date;
		$.getJSON(target, function(json) {
			$.each(json, function(fid, ids) {
				var group = $.map(ids['IN'].concat(ids['OUT']), function(id) {
					return self.detectors[id];
				});
				self.fatvs[fid] = group;
			});
		});
	},

	'createMarkers': function() {
		this.detectors = {};
		var self = this;
		var target = root_api + 'data/detectors' + '?date=' + window.date;
		$.ajax({
			dataType: 'json',
			url: target,
			beforeSend: function (xhr) {
				xhr.setRequestHeader('Authorization', ID_TOKEN)
			},
			error: relog,
			success: function(json) {
				$.each(json, function(id, info) {
					info.loc = [info.lat, info.lon];
					var peerless = (info.fatv_in == null) && (info.fatv_out == null);
					var marker = L.marker(info.loc, {
						icon: peerless ? self.peerlessIcon : self.standardIcon,
						opacity: 0.9
					});
					marker.id = id;
					marker.info = info;

					marker.bindPopup(marker.id);
					marker.on({
						'click': function(e) {self.onSelect(this)},
						'mouseover': self.onHover,
						'mouseout': self.onExit,
					});

					self.detectors[id] = marker;
					if (peerless) {
						self.peerlessGroup.push(marker);
					}
				});

				//self.markErrors(date);
				self.all_layer = L.featureGroup($.map(self.detectors, function(det) {return det;}));
				self.all_layer.addTo(self.map);
			}
		}).then(this.getFATVs.bind(this)).then(this.markErrors.bind(this));
	},

	'markErrors': function(date) {
		for (id in this.marked) {
			this.detectors[id].setIcon(this.standardIcon);
		};
		var self = this;
		var target = root_api + 'data/diagnosis' + '?date=' + window.date;
		$.ajax({
			url: target,
			dataType: 'json',
			beforeSend: function (xhr) {
				xhr.setRequestHeader('Authorization', ID_TOKEN)
			},
			error: relog,
			success: function(marked) {
				self.marked = marked;
				var states = {};
				$.each(marked["unknown"], function(idx, det) {
					var detector = self.detectors[det];
					if (detector) {
						states[detector.id] = "unknown";
						detector.setIcon(self.unknownIcon);
					}
				});
				$.each(marked["unobv"], function(idx, det) {
					var detector = self.detectors[det];
					if (detector) {
						states[detector.id] = "unobv";
						detector.setIcon(self.emptyIcon);
					}
				});

				$.each(marked["error"], function(idx, det) {
					var detector = self.detectors[det];
					if (detector) {
						states[detector.id] = "error";
						detector.setIcon(self.errorIcon);
					}
				});

				$.each(marked["untracked"], function(idx, det) {
					var detector = self.detectors[det];
					if (detector) {
						states[detector.id] = "untracked";
						detector.setIcon(self.untrackedIcon);
					}
				});

				$.each(marked["singleton"], function(idx, det) {
					var detector = self.detectors[det];
					if (detector) {
						states[detector.id] = "singleton";
						detector.setIcon(self.edgeIcon);
					}
				});


				for (det in states) {
					if (states[det] == "unknown") {
						self.unknownGroup.push(self.detectors[det]);
					} else if (states[det] == "unobv") {
						self.unobvGroup.push(self.detectors[det]);
					} else if (states[det] == "error") {
						self.errorGroup.push(self.detectors[det]);
					} else if (states[det] == "untracked") {
						self.untrackedGroup.push(self.detectors[det]);
					} else if (states[det] == "singleton") {
						self.edgeGroup.push(self.detectors[det]);
					}
				}
				self.state_layers.push(L.featureGroup(self.unobvGroup));
				self.state_layers.push(L.featureGroup(self.unknownGroup));
				self.state_layers.push(L.featureGroup(self.peerlessGroup));
				self.state_layers.push(L.featureGroup(self.untrackedGroup));
				self.state_layers.push(L.featureGroup(self.edgeGroup));
				self.state_layers.push(L.featureGroup(self.errorGroup));
			}
		});

		this.fillTable(this.detectors[Object.keys(this.detectors)[0]]);
	},

	'onSelect': function(detector) {
		var old = this.selected;

		this.selectedMarker.setLatLng(detector.info.loc);
		if (!old) {
			this.selectedMarker.addTo(this.map);
		};

		this.selected = detector;
		this.fillTable(detector);
		this.showPlots(detector, old);
		this.showNeighborhood(detector)
	},
	
	'fillTable': function (detector) {
		if (date) {
			$('#date-val').text(date);
		} else {
			$.ajax({
				url: root_api + 'data/latest',
				dataType: 'json',
				beforeSend: function (xhr) {
					xhr.setRequestHeader('Authorization', ID_TOKEN)
				},
				error: relog,
				success: function(latest) {
					var date = latest.date;
					$('#date-val').text(date);
				}
			});
		}

		$('#det-name').text(detector.info["Name"]);
		$('#det-id').text(detector.id);
		$('#det-fwy').text(detector.info["Fwy"]);
		$('#det-type').text(detector.info["Type"]);
		$('#det-dir').text(detector.info["Dir"]);
		$('#det-lanes').text(detector.info["Lanes"]);
		$('#det-city').text(detector.info["City"]);
		$('#det-lat').text(detector.info["lat"]);
		$('#det-lon').text(detector.info["lon"]);
		$('#det-fatv-in').text("-");
		$('#det-fatv-out').text("-");
	},

	'onHover': function(e) {
		this.openPopup();
	},

	'onExit': function(e) {
		this.closePopup();
	},

	'init': function() {

		this.map = L.map('leaf-map').setView(this.settings.home, this.settings.homeZoom);
		this.n_layer = null;
		this.selected = null;
		this.state_layers = [];
		this.active_state = -1;
		this.marked = {};
		this.unknownGroup = [];
		this.unobvGroup = [];
		this.errorGroup = [];
		this.untrackedGroup = [];
		this.edgeGroup = [];
		this.peerlessGroup = [];

		L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
			attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
			maxZoom: 18,
			id: 'mapbox.streets',
			accessToken: 'pk.eyJ1IjoicnBpZ290dCIsImEiOiJjajR5b2gza3QxeG9sMndyNDI1ZWx1dnRoIn0.KWaGwMzYy_P5PRjGJY5xXQ'
		}).addTo(this.map);

		this.createMarkers();
		//this.getFATVs();

		this.resetButton = L.easyButton('fa-home fa-lg', this.resetView.bind(this));
		this.resetButton.addTo(this.map);

		this.tagsButton = L.easyButton('fa-tags ta-lg', this.cycleLayers.bind(this));
		this.tagsButton.addTo(this.map);

		var self = this;
		this.showHideButton = L.easyButton({
			states: [{
					stateName: 'hide',
					icon:	   'fa-eye fa-lg',
					title:	   'Show only selected neighborhood',
					onClick: function(btn, map) {
						if (!!self.n_layer) {
							self.map.removeLayer(self.all_layer);
							self.n_layer.addTo(self.map);
							btn.state('show');
						};
					}
				}, {
					stateName: 'show',
					icon:	   'fa-eye-slash fa-lg',
					title:	   'Show all detectors',
					onClick: function(btn, map) {
						if (self.n_layer) {
							self.map.removeLayer(self.n_layer);
						}
						if (self.active_state >= 0) {
							self.map.removeLayer(self.state_layers[self.active_state]);
							self.active_state = -1;
							$('.legend-tag').removeClass('highlight');
						}
						self.all_layer.addTo(self.map);
						btn.state('hide');
					}
			}]
		});
		this.showHideButton.addTo(this.map);

		return this;
	},

	'resetView': function(btn, map) {
		map.fitBounds(this.all_layer.getBounds());
	},

	'cycleLayers': function(btn, map) {
		$('.legend-tag').removeClass('highlight');
		if (this.active_state == -1) {
			map.removeLayer(this.all_layer);
			this.showHideButton.state('show');
			this.active_state += 1
			this.state_layers[this.active_state].addTo(map);
		} else {
			map.removeLayer(this.state_layers[this.active_state])
			if (this.active_state + 1 >= this.state_layers.length) {
				this.active_state = -1;
				this.showHideButton.state('hide');
				this.all_layer.addTo(map);
			} else {
				this.active_state += 1;
				this.state_layers[this.active_state].addTo(map);
			}
		}
		$(this.tagStates[this.active_state]).addClass('highlight');
	},

	'showPlots': function(detector, old) {

		var self = this;

		function titleize(dets) {
			return $.map(dets, function(det) {
				if (self.selected.id == det) {
					return $('<a>', {
						text: det,
						href: '#'
					})[0].outerHTML;
				} else {
					return det
				}
			});
		}

		if (detector.info.fatv_in !== null) {
			var target = root_api + 'data/plot/' + detector.info.fatv_in + '?date=' + window.date;
			$.ajax({
				url: target,
				dataType: 'json',
				beforeSend: function (xhr) {
					xhr.setRequestHeader('Authorization', ID_TOKEN)
				},
				success: function(flows) {
					// Plotly.purge('plot-1');
					if (self.selected == detector) {
						Plotly.newPlot('plot-1', [flows['IN']['data'], flows['OUT']['data']], {
							'title': 'FATV ' + detector.info.fatv_in + '<br>' +
							'IN: ' + titleize(flows['IN']['detectors']).join(', ') + '<br>' +
							'OUT: ' + titleize(flows['OUT']['detectors']).join(', '),

							'xaxis': {
								'title': 'Time'
							},
							'yaxis': {
								'title': 'Vehicles / 5min'
							}
						});
						var relerr = flows['stats']['relerr'] * 100
						$('#det-fatv-in').text(
							flows['stats']['miscount'] + " (" + relerr.toFixed(3) + "%)"
						);
					};
				}
			}).fail(function (jqxhr, textStatus, errorThrown) {console.log(textStatus, errorThrown)});
		} else {
			Plotly.purge('plot-1');
		};

		if (detector.info.fatv_out !== null) {
			var target = root_api + 'data/plot/' + detector.info.fatv_out + '?date=' + window.date;
			$.ajax({
				url: target,
				dataType: 'json',
				beforeSend: function (xhr) {
					xhr.setRequestHeader('Authorization', ID_TOKEN)
				},
				success: function(flows) {
					// Plotly.purge('plot-2');
					if (self.selected == detector) {
						Plotly.newPlot('plot-2', [flows['IN']['data'], flows['OUT']['data']], {
							'title': 'FATV ' + detector.info.fatv_out + '<br>' +
							'IN: ' + titleize(flows['IN']['detectors']).join(', ') + '<br>' +
							'OUT: ' + titleize(flows['OUT']['detectors']).join(', '),

							'xaxis': {
								'title': 'Time'
							},
							'yaxis': {
								'title': 'Vehicles / 5min'
							}
						});
						var relerr = flows['stats']['relerr'] * 100
						$('#det-fatv-out').text(
							flows['stats']['miscount'] + " (" + relerr.toFixed(3) + "%)"
						);
					};
				}
			});
		} else {
			Plotly.purge('plot-2')
		};
	},

	'showNeighborhood': function(detector) {
		var dets = [detector];
		var din = this.fatvs[detector.info.fatv_in];
		var dout = this.fatvs[detector.info.fatv_out];

		if (din) {
			dets = dets.concat(din);
		}
		if (dout) {
			dets = dets.concat(dout);
		}

		if (this.n_layer) {
			this.map.removeLayer(this.n_layer);
		}

		this.n_layer = L.featureGroup(dets);
		this.map.removeLayer(this.all_layer);
		this.n_layer.addTo(this.map);
		this.map.fitBounds(this.n_layer.getBounds());
		this.showHideButton.state('show');
	}
};

(function($) {
var re = /([^&=]+)=?([^&]*)/g;
var decodeRE = /\+/g;  // Regex for replacing addition symbol with a space
var decode = function (str) {return decodeURIComponent( str.replace(decodeRE, " ") );};
$.parseParams = function(query) {
	var params = {}, e;
	while ( e = re.exec(query) ) { 
		var k = decode( e[1] ), v = decode( e[2] );
		if (k.substring(k.length - 2) === '[]') {
			k = k.substring(0, k.length - 2);
			(params[k] || (params[k] = [])).push(v);
		}
		else params[k] = v;
	}
	return params;
};
})(jQuery);

$('document').ready(function() {
	root_api = 'https://2o0pm5fi7f.execute-api.us-west-2.amazonaws.com/alpha/'
	date = $.parseParams(window.location.search.substr(1)).date || ''
	
	ID_TOKEN = window.location.hash.substr(1).split('&')[0].split('=')[1] || window.sessionStorage["id_token"];
	window.sessionStorage["id_token"] = ID_TOKEN;
	window.location.hash = '';

	selector = Selector.init();

	$('#plot-1').on('plotly_relayout', function(e, edata) {
		Plotly.relayout('plot-2', edata);
	});

	$('#detector-search').on('submit', function (e) {
		e.preventDefault();
		var detector = $('#detector-search input[name=detector-id]')[0].value;
		var mark = selector.detectors[detector];
		if (!mark) {
			alert("No such detector: " + detector);
		} else {
			selector.onSelect(mark);
		};
	});

	$('#date-patch').on('submit', function (e) {
		e.preventDefault();
		setIndicator($('#date-patch .indicator'), 'busy');

		$.ajax({
			type: 'post',
			url: root_api + 'analyze',
			beforeSend: function (xhr) {
				xhr.setRequestHeader('Authorization', ID_TOKEN)
			},
			data: $('#date-patch').serialize(),
			fail: function() {setIndicator($('#date-patch .indicator'), 'fail');},
			success: function() {setIndicator($('#date-patch .indicator'), 'complete');}
		})
	});
});

// vim: set fdm=marker:
