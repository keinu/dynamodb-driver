module.exports = (function() {

	var itemize = function(param) {

		if (param === null) {

			return {"NULL" : true};

		} else if (typeof param === "string") {

			if (param === "") {
				return {"NULL" : true};
			} else {
				return {"S" : param};
			}

		} else if (typeof param === "boolean") {

			return {"BOOL" : param};

		} else if (typeof param === "number") {

			return {"N" : param};

		} else if (Array.isArray(param) && param.length > 0) {

			if (typeof param[0] === "string") {

				return {"SS" : param};

			} else if (typeof param[0] === "number") {

				return {"NS" : param};

			} else {

				return {"L": param.map(function(value) {
					return itemize(value);
				})};

			}

		} else {

			var object = {};
			for (var key in param) {
				if (param.hasOwnProperty(key)) {
					object[key] = itemize(param[key]);
				}
			}

			return {"M": object};

		}

	};


	var deitemize = function(item) {

		if (!item) {
			return null;
		}

		if (item.S) {
			return item.S;
		}

		if (item.N) {
			return item.N;
		}

		if (item.SS) {
			return item.SS;
		}

		if (item.NS) {
			return item.NS;
		}

		if (typeof item.BOOL !== "undefined") {
			return (item.BOOL) ? true : false;
		}

		if (item.NULL) {
			return null;
		}

		if (item.L) {

			var array = [];
			item.L.forEach(function(item) {

				array.push(deitemize(item));

			});

			return array;

		}

		if (item.M) {

			var object = {};
			Object.keys(item.M).forEach(function(key) {

				object[key] = deitemize(item.M[key]);

			});

			if (Object.keys(object).length > 0) {
				return object;
			}

			return null;

		}

		var items = {};
		Object.keys(item).forEach(function(key) {

			items[key] = deitemize(item[key]);

		});

		return items;

	};

	return {
		itemize: itemize,
		deitemize: deitemize
	};

})();