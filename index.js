var AWS = require('aws-sdk'),
	Q = require("q"),
	shortid = require('shortid');

module.exports = function(awsconfig, dynamodboptions) {

	AWS.config.update(awsconfig);

	var dynamodb = new AWS.DynamoDB(dynamodboptions);

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

	var query = function(table, conditions, index) {

		var params = {
			TableName: table
		};

		if (index) {
			params.IndexName = index;
		}

		var keys = {};
		conditions.forEach(function(condition) {

			keys[condition.key] = {
				ComparisonOperator: condition.operator,
				AttributeValueList: [itemize(condition.value)],
			};

		});

		console.log("Query %s with index [%s] with ", table, index, JSON.stringify(keys, null, 2));

		params.KeyConditions = keys;

		var deferred = Q.defer();
		dynamodb.query(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				return deferred.reject(err);
			}

			var items = [];
			data.Items.forEach(function(item) {
				items.push(deitemize(item));
			});

			deferred.resolve(items);

		});

		return deferred.promise;

	};

	var list = function(table, conditions) {

		var params = {
			TableName: table
		};

		var keys = {};
		conditions.forEach(function(condition) {

			keys[condition.key] = {
				ComparisonOperator: condition.operator,
				AttributeValueList: [itemize(condition.value)],
			};

		});

		console.log("Scan %s with", table, JSON.stringify(keys, null, 2));

		params.ScanFilter = keys;

		var deferred = Q.defer();
		dynamodb.scan(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}

			var items = [];
			data.Items.forEach(function(item) {
				items.push(deitemize(item));
			});

			deferred.resolve(items);

		});

		return deferred.promise;

	};

	var get = function(table, id) {

		var params = {
			TableName: table,
			Key: {
				"id": {
					"S": id
				}
			}
		};

		var deferred = Q.defer();
		dynamodb.getItem(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}


			console.log("DATA", data);

			var output = deitemize(data.Item);
			deferred.resolve(output);

		});

		return deferred.promise;

	};


	var getItems = function(table, ids) {

		var params = {
			RequestItems: {}
		};

		var keys = [];
		ids.forEach(function(id) {

			keys.push({
				"id": itemize(id)
			});

		});

		params.RequestItems[table] = {
			ConsistentRead: true,
			Keys: keys
		};

		console.log("Get Batch Items on [%s] with", table, JSON.stringify(params, null, 2));

		var deferred = Q.defer();
		dynamodb.batchGetItem(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}

			var output = [];
			if (!data.Responses) {
				deferred.resolve(output);
			}

			data.Responses[table].forEach(function(item) {
				output.push(deitemize(item));
			});

			deferred.resolve(output);

		});

		return deferred.promise;

	};

	var create = function(table, document) {

		document.id = shortid.generate();

		var item = {};
		Object.keys(document).forEach(function(key) {
			item[key] = itemize(document[key]);
		});

		var params = {
			ReturnConsumedCapacity: "TOTAL",
			ReturnItemCollectionMetrics: "SIZE",
			ReturnValues: "ALL_OLD",
			TableName: table,
			Item: item
		};

		console.log("Will create with ", params);

		var deferred = Q.defer();
		dynamodb.putItem(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}

			console.log("CREATED");
			deferred.resolve(document);

		});

		return deferred.promise;

	};

	var update = function(table, document) {

		var items = {};
		Object.keys(document).forEach(function(key) {

			if (key === "id") {
				return;
			}

			var action;
			if (document[key]) {
				items[key] = {
					Value: itemize(document[key]),
					Action: "PUT"
				};
			} else {
				items[key] = {
					Action: "DELETE"
				};
			}

		});

		var params = {
			ReturnConsumedCapacity: "TOTAL",
			ReturnItemCollectionMetrics: "SIZE",
			ReturnValues: "ALL_NEW",
			Key: {
				"id": itemize(document.id)
			},
			AttributeUpdates: items,
			TableName: table,
		};

		console.log("Will update with ", JSON.stringify(params, null, 2));

		var deferred = Q.defer();
		dynamodb.updateItem(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}

			console.log("UPDATED");
			deferred.resolve(document);


		});

		return deferred.promise;

	};

	var remove = function(table, document) {

		var key = {};
		Object.keys(document).forEach(function(k) {
			key[k] = itemize(document[k]);
		});

		var params = {
			TableName: table,
			Key: key
		};

		console.log("Delete item in %s with ", table, params);

		var deferred = Q.defer();
		dynamodb.deleteItem(params, function(err, data) {

			if (err) {
				console.log(err, err.stack);
				deferred.reject(err);
			}

			console.log("DELETED");
			deferred.resolve();

		});

		return deferred.promise;

	};

	return {
		list: list,
		query: query,
		get: get,
		getItems: getItems,
		create: create,
		update: update,
		remove: remove,
	};

};