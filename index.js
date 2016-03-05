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

		// Legacy KeyConditions are in use
		if (conditions.constructor === Array) {

			var keys = {};
			conditions.forEach(function(condition) {

				keys[condition.key] = {
					ComparisonOperator: condition.operator,
					AttributeValueList: [utils.itemize(condition.value)],
				};

			});

			params.KeyConditions = keys;

		}

		// KeyConditionExpression are in use
		if (conditions.constructor === Object) {

			params.KeyConditionExpression = conditions.KeyConditionExpression;
			params.ExpressionAttributeNames = conditions.ExpressionAttributeNames;

			var ExpressionAttributeValues = {};

			var values = conditions.ExpressionAttributeValues;

			for (var p in values) {
				if (!values.hasOwnProperty(p)) {
					continue;
				}
				ExpressionAttributeValues[p] = utils.itemize(values[p]);
			}

			params.ExpressionAttributeValues = ExpressionAttributeValues;

		}

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

	var getItems = function(table, ids, options) {

		if (ids.constructor !== Array) {
			throw Error("ids is not an Array");
		}

		if (ids.length === 0) {
			return Promise.resolve([]);
		}

 		var params = {
			RequestItems: {}
		};

		var keys = ids.map(function(id) {
			return {
				"id": utils.itemize(id)
			};
		});

		var consistendRead = false;
		if (options && options.consistentRead) {
			params.consistentRead = true;
		}

		params.RequestItems[table] = {
			ConsistentRead: params.consistentRead,
			Keys: keys
		};

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

	var create = function(table, document, conditions) {

		if (!document.id) {
			document.id = shortid.generate();
		}

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

		// KeyConditionExpression are in use
		if (conditions && conditions.constructor === Object) {

			params.ConditionExpression = conditions.ConditionExpression;

			if (conditions.ExpressionAttributeNames) {
				params.ExpressionAttributeNames = conditions.ExpressionAttributeNames;
			}

			var ExpressionAttributeValues = {};

			var values = conditions.ExpressionAttributeValues;

			for (var p in values) {
				if (!values.hasOwnProperty(p)) {
					continue;
				}
				ExpressionAttributeValues[p] = utils.itemize(values[p]);
			}

			params.ExpressionAttributeValues = ExpressionAttributeValues;

		}

		return dynamodb.putItemAsync(params).then(function(data) {

			return document;

		});

	};

	var createItems = function(table, documents) {

		var maxWriteItems = 25; // Currently 25 on AWS

		// Returns a promise of the wripte operation
		var writeOperation = function(documentsToWrite) {

			// Constructs the request
			var params = {
				RequestItems: {}
			};

			params.RequestItems[table] = [];

			documentsToWrite.forEach(function(document) {

				// Dop not generate id if already present
				if (!document.id) {
					document.id = shortid.generate();
				}

				var item = {};
				Object.keys(document).forEach(function(key) {
					item[key] = utils.itemize(document[key]);
				});

				params.RequestItems[table].push({
					PutRequest: {
						Item: item
					}
				});

			});

			// Sends the request
			// console.log("Saving %s items", documentsToWrite.length);
			return dynamodb.batchWriteItemAsync(params);

		};

		// Contains arrays of $maxWriteItems items to save
		var documentsToWrite = [];

		while (documents.length) {
			documentsToWrite.push(documents.splice(0, maxWriteItems));
		}

		// Wait for all promisses to be fullfilled one by one
		return Promise.each(documentsToWrite, writeOperation);

	};

	var update = function(table, document, conditions) {

		var ExpressionAttributeNames = {};
		var ExpressionAttributeValues = {};
		var UpdateExpressions = [];

		Object.keys(document).forEach(function(key) {

			if (key === "id") {
				return;
			}

			ExpressionAttributeNames["#" + key] = key;
			ExpressionAttributeValues[":" + key] = utils.itemize(document[key]);

			UpdateExpressions.push("#" + key + " = " + ":" + key);

		});

		var params = {
			ReturnConsumedCapacity: "TOTAL",
			ReturnItemCollectionMetrics: "SIZE",
			ReturnValues: "ALL_NEW",
			Key: {
				"id": utils.itemize(document.id)
			},
			ExpressionAttributeNames: ExpressionAttributeNames,
			ExpressionAttributeValues: ExpressionAttributeValues,
			UpdateExpression: "SET " + UpdateExpressions.join(", "),
			TableName: table,
		};

		if (conditions && conditions.constructor === Object) {

			params.ConditionExpression = conditions.ConditionExpression;

			// Append condition values to ExpressionAttributeValues
			var values = conditions.ExpressionAttributeValues;
			Object.keys(values).forEach(function(key) {
				params.ExpressionAttributeValues[key] = utils.itemize(values[key]);
			});

		}

		return dynamodb.updateItemAsync(params).then(function() {

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
		createItems: createItems,
		update: update,
		remove: remove,
	};

};