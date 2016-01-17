var AWS = require('aws-sdk'),
	Promise = require("bluebird"),
	shortid = require('shortid');


var utils = require("./utils");

module.exports = function(awsconfig, dynamodboptions) {

	AWS.config.update(awsconfig);

	var dynamodb = new Promise.promisifyAll(new AWS.DynamoDB(dynamodboptions));

	var query = function(table, conditions, index, options) {

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
				AttributeValueList: [utils.itemize(condition.value)],
			};

		});

		if (options && options.reverse) {
			params.ScanIndexForward = false;
		}

		if (options && options.limit) {
			params.Limit = options.limit;
		}

		if (options && options.filter) {

			var queryFilter = {};

			options.filter.forEach(function(condition) {

				queryFilter[condition.key] = {
					ComparisonOperator: condition.operator,
					AttributeValueList: [utils.itemize(condition.value)],
				};

			});

			params.QueryFilter = queryFilter;
		}

		params.KeyConditions = keys;

		return dynamodb.queryAsync(params).then(function(data) {

			var items = [];
			data.Items.forEach(function(item) {
				items.push(utils.deitemize(item));
			});

			return items;

		});

	};

	var list = function(table, conditions) {

		var params = {
			TableName: table
		};

		var keys = {};
		conditions.forEach(function(condition) {

			keys[condition.key] = {
				ComparisonOperator: condition.operator,
				AttributeValueList: [utils.itemize(condition.value)],
			};

		});

		// console.log("Scan %s with", table, JSON.stringify(keys, null, 2));

		params.ScanFilter = keys;

		return dynamodb.scanAsync(params).then(function(data) {

			var items = [];
			data.Items.forEach(function(item) {
				items.push(utils.deitemize(item));
			});

			return items;

		});

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

		return dynamodb.getItemAsync(params).then(function(data) {

			return utils.deitemize(data.Item);

		});

	};


	var getItems = function(table, ids) {

		var params = {
			RequestItems: {}
		};

		var keys = [];
		ids.forEach(function(id) {

			keys.push({
				"id": utils.itemize(id)
			});

		});

		params.RequestItems[table] = {
			ConsistentRead: true,
			Keys: keys
		};

		// console.log("Get Batch Items on [%s] with", table, JSON.stringify(params, null, 2));

		return dynamodb.batchGetItemAsync(params).then(function(data) {

			var output = [];
			if (!data.Responses) {
				return output;
			}

			data.Responses[table].forEach(function(item) {
				output.push(utils.deitemize(item));
			});

			return output;

		});

	};

	var create = function(table, document) {

		document.id = shortid.generate();

		var item = {};
		Object.keys(document).forEach(function(key) {
			item[key] = utils.itemize(document[key]);
		});

		var params = {
			ReturnConsumedCapacity: "TOTAL",
			ReturnItemCollectionMetrics: "SIZE",
			ReturnValues: "ALL_OLD",
			TableName: table,
			Item: item
		};

		// console.log("Will create with ", params);

		return dynamodb.putItemAsync(params).then(function(data) {

			return document;

		});

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
					Value: utils.itemize(document[key]),
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
				"id": utils.itemize(document.id)
			},
			AttributeUpdates: items,
			TableName: table,
		};

		//console.log("Will update with ", JSON.stringify(params, null, 2));

		return dynamodb.updateItemAsync(params).then(function(data) {

			return document;

		});

	};

	var remove = function(table, document) {

		var key = {};
		Object.keys(document).forEach(function(k) {
			key[k] = utils.itemize(document[k]);
		});

		var params = {
			TableName: table,
			Key: key
		};

		return dynamodb.deleteItemAsync(params);

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