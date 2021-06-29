const Promise = require("bluebird");
const { v4: uuidv4 } = require("uuid");

const AWS = require("aws-sdk");
AWS.config.setPromisesDependency(Promise);

const utils = require("./utils");

global.__basePath = process.env.PWD;

module.exports = function (dynamoDbOptions) {
	"use strict";

	const dynamodb = new AWS.DynamoDB(dynamoDbOptions);

	const query = function (table, conditions, index, options) {
		const params = {
			TableName: table
		};

		if (index) {
			params.IndexName = index;
		}

		// Legacy KeyConditions are in use
		if (conditions.constructor === Array) {
			const keys = {};
			conditions.forEach(function (condition) {
				keys[condition.key] = {
					ComparisonOperator: condition.operator,
					AttributeValueList: [utils.itemize(condition.value)]
				};
			});

			params.KeyConditions = keys;
		}

		// KeyConditionExpression are in use
		if (conditions.constructor === Object) {
			params.KeyConditionExpression = conditions.KeyConditionExpression;
			params.ExpressionAttributeNames = conditions.ExpressionAttributeNames;

			const ExpressionAttributeValues = {};

			const values = conditions.ExpressionAttributeValues;

			for (const property in values) {
				if (!values.hasOwnProperty(property)) {
					continue;
				}
				ExpressionAttributeValues[property] = utils.itemize(values[property]);
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
			const queryFilter = {};

			options.filter.forEach(function (condition) {
				queryFilter[condition.key] = {
					ComparisonOperator: condition.operator,
					AttributeValueList: [utils.itemize(condition.value)]
				};
			});

			params.QueryFilter = queryFilter;
		}

		if (options && options.projection && options.projection.length) {
			params.ProjectionExpression = options.projection.map(p => `#${p}`).join(",");
			params.ExpressionAttributeNames = {};

			options.projection.forEach(function (p) {
				params.ExpressionAttributeNames[`#${p}`] = p;
			});
		}

		if (options && options.paginate) {
			const items = [];

			const paginate = function (lastItem) {
				params.Limit = options.paginate;

				if (lastItem) {
					params.ExclusiveStartKey = lastItem;
				}

				return dynamodb
					.query(params)
					.promise()
					.then(function (data) {
						data.Items.forEach(function (item) {
							items.push(utils.deitemize(item));
						});

						if (data.LastEvaluatedKey) {
							return paginate(data.LastEvaluatedKey);
						}

						return items;
					});
			};

			return paginate();
		}

		return dynamodb
			.query(params)
			.promise()
			.then(function (data) {
				const items = [];
				data.Items.forEach(function (item) {
					items.push(utils.deitemize(item));
				});
				return items;
			});
	};

	const list = function (table, conditions, options) {
		const params = {
			TableName: table
		};

		const keys = {};

		conditions = conditions || [];
		conditions.forEach(function (condition) {
			keys[condition.key] = {
				ComparisonOperator: condition.operator,
				AttributeValueList: [utils.itemize(condition.value)]
			};
		});

		if (options && options.projection && options.projection.length) {
			params.ProjectionExpression = options.projection.map(p => `#${p}`).join(",");
			params.ExpressionAttributeNames = {};

			options.projection.forEach(function (p) {
				params.ExpressionAttributeNames[`#${p}`] = p;
			});
		}

		if (Object.keys(keys).length) {
			params.ScanFilter = keys;
		}

		if (options && options.paginate) {
			const items = [];

			const paginate = function (lastItem) {
				params.Limit = options.paginate;

				if (lastItem) {
					params.ExclusiveStartKey = lastItem;
				}

				return dynamodb
					.scan(params)
					.promise()
					.then(function (data) {
						data.Items.forEach(function (item) {
							items.push(utils.deitemize(item));
						});

						if (data.LastEvaluatedKey) {
							return paginate(data.LastEvaluatedKey);
						}

						return items;
					});
			};

			return paginate();
		}

		if (options && options.limit) {
			params.Limit = options.limit;
		}

		if (options && options.exclusiveStartKey) {
			params.ExclusiveStartKey = options.exclusiveStartKey;
		}

		return dynamodb
			.scan(params)
			.promise()
			.then(function (data) {
				const items = [];
				data.Items.forEach(function (item) {
					items.push(utils.deitemize(item));
				});

				// return an object with the items and
				//last evaluated key if the option is specified.
				if (options && options.getLastEvaluatedKey) {
					return {
						items,
						lastEvaluatedKey: data.LastEvaluatedKey
					};
				}

				return items;
			});
	};

	const get = function (table, id) {
		const params = {
			TableName: table,
			Key: {
				id: {
					S: id
				}
			}
		};

		return dynamodb
			.getItem(params)
			.promise()
			.then(function (data) {
				return utils.deitemize(data.Item);
			});
	};

	const getItems = function (table, ids, options) {
		if (ids.constructor !== Array) {
			throw Error("ids is not an Array");
		}

		// Don't touch the original items, work on a copy
		const documents = ids.slice(0);

		if (!documents || documents.length === 0) {
			return Promise.resolve([]);
		}

		let items = [];

		options = options || {};

		const maxGetItems = 100; // Currently 25 on AWS

		// For fibonacci exponential backoff
		let previous = 1;
		let anteprevious = 1;
		let delay = 0;

		// For reverting the back-off
		const series = [0];

		const getDocuments = function (Requests) {
			// Constructs the request
			const params = {
				RequestItems: {}
			};

			params.RequestItems[table] = Requests;

			return dynamodb
				.batchGetItem(params)
				.promise()
				.then(function (batchResponse) {
					const docs = batchResponse.Responses[table].map(i => utils.deitemize(i));

					items = items.concat(docs);

					if (
						batchResponse.UnprocessedKeys[table] &&
						Array.isArray(batchResponse.UnprocessedKeys[table].Keys)
					) {
						console.log(
							"%s unprocessed items",
							batchResponse.UnprocessedKeys[table].Keys.length
						);
						let delayAction;

						if (options.noDelay) {
							delayAction = Promise.resolve();
						} else {
							// Keep the list of delays
							series.push(delay);

							delay = previous + anteprevious;

							anteprevious = previous;
							previous = delay;

							console.log("Delaying next batch, %d seconds", delay);
							delayAction = Promise.delay(delay * 1000);
						}

						return delayAction.then(function () {
							return getDocuments(batchResponse.UnprocessedKeys[table]);
						});
					}

					// Revert the back of to the latest position
					// Not putting the back off to 0 to keep playing nicely
					if (series.length > 1) {
						previous = series.pop() || 0;
					}
				})
				.catch(function (err) {
					if (err.code === "ProvisionedThroughputExceededException") {
						console.log(
							"Provisioned Capacity error when getting items, delaying 15 seconds"
						);
						return Promise.delay(15 * 1000).then(function () {
							return getDocuments(Requests);
						});
					}

					console.log(err);
					throw err;
				});
		};

		// Returns a promise of the write operation
		const getOperation = function (documentsSet) {
			const keys = documentsSet.map(function (document) {
				if (!options.keys) {
					// By default, the parameters are an array of ids
					return {
						id: utils.itemize(document)
					};
				}

				// options.keys is specified as an array of values for hash or hash & key
				return options.keys.reduce(function (acc, key) {
					acc[key] = utils.itemize(document[key]);

					return acc;
				}, {});
			});

			const params = {
				ConsistentRead: options.consistentRead || false,
				Keys: keys
			};

			if (options && Array.isArray(options.projection)) {
				params.ProjectionExpression = options.projection.map(p => `#${p}`).join(",");

				params.ExpressionAttributeNames = options.projection.reduce(
					(attributeNames, attributeName) => {
						attributeNames[`#${attributeName}`] = attributeName;
						return attributeNames;
					},
					{}
				);
			}

			return getDocuments(params);
		};

		// Contains arrays of $maxWriteItems items to save
		const documentsToGet = [];

		while (documents.length) {
			documentsToGet.push(documents.splice(0, maxGetItems));
		}

		// Wait for all promises to be fulfilled one by one
		return Promise.each(documentsToGet, getOperation).then(() => items);
	};

	const create = function (table, document, conditions) {
		if (!document.id) {
			document.id = uuidv4();
		}

		const item = {};
		Object.keys(document).forEach(function (key) {
			item[key] = utils.itemize(document[key]);
		});

		const params = {
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

			const ExpressionAttributeValues = {};

			const values = conditions.ExpressionAttributeValues;

			for (const p in values) {
				if (!values.hasOwnProperty(p)) {
					continue;
				}
				ExpressionAttributeValues[p] = utils.itemize(values[p]);
			}

			params.ExpressionAttributeValues = ExpressionAttributeValues;
		}

		return dynamodb
			.putItem(params)
			.promise()
			.then(function () {
				return document;
			});
	};

	const createItems = function (table, items) {
		// Don't touch the original items, work on a copy
		const documents = items.slice(0);

		if (!documents || documents.length === 0) {
			return Promise.resolve();
		}

		const maxWriteItems = 25; // Currently 25 on AWS

		// For fibonacci exponential backoff
		let previous = 1;
		let anteprevious = 1;
		let delay = 0;

		// For reverting the back-off
		const series = [0];

		const writeItems = function (itemsToWrite) {
			// Constructs the request
			const params = {
				RequestItems: {}
			};

			params.RequestItems[table] = itemsToWrite;

			return dynamodb
				.batchWriteItem(params)
				.promise()
				.then(function (batchResponse) {
					if (batchResponse.UnprocessedItems[table]) {
						// Keep the list of delays
						series.push(delay);

						delay = previous + anteprevious;

						anteprevious = previous;
						previous = delay;

						console.log(
							"%s unprocessed items",
							batchResponse.UnprocessedItems[table].length
						);
						console.log("Delaying next batch, %d seconds", delay);

						return Promise.delay(delay * 1000).then(function () {
							return writeItems(batchResponse.UnprocessedItems[table]);
						});
					}

					// Revert the back of to the latest position
					// Not putting the back off to 0 to keep playing nicely
					if (series.length > 1) {
						previous = series.pop() || 0;
					}
				})
				.catch(function (err) {
					if (err.code === "ProvisionedThroughputExceededException") {
						console.log(
							"Provisioned Capacity error when creating items, delaying 15 seconds"
						);

						return Promise.delay(15 * 1000).then(function () {
							return writeItems(itemsToWrite);
						});
					}

					console.log(err);
					throw err;
				});
		};

		// Returns a promise of the write operation
		const writeOperation = function (documentsToWrite) {
			const itemsToWrite = [];
			documentsToWrite.forEach(function (document) {
				// Dop not generate id if already present
				if (!document.id) {
					document.id = uuidv4();
				}

				const item = {};
				Object.keys(document).forEach(function (key) {
					item[key] = utils.itemize(document[key]);
				});

				itemsToWrite.push({
					PutRequest: {
						Item: item
					}
				});
			});

			return writeItems(itemsToWrite);
		};

		// Contains arrays of $maxWriteItems items to save
		const chunkedDocuments = [];

		while (documents.length) {
			chunkedDocuments.push(documents.splice(0, maxWriteItems));
		}

		// Wait for all promises to be fulfilled one by one
		return Promise.each(chunkedDocuments, writeOperation);
	};

	const removeItems = function (table, items, keys) {
		// Don't touch the original items, work on a copy
		const documents = items.slice(0);

		if (!documents || documents.length === 0) {
			return Promise.resolve();
		}

		// By default id will be the key
		if (!keys) {
			keys = ["id"];
		}

		const maxWriteItems = 25; // Currently 25 on AWS

		// For fibonacci exponential backoff
		let previous = 1;
		let anteprevious = 1;
		let delay = 0;

		// For reverting the back-off
		const series = [0];

		const deleteItems = function (PutRequests) {
			// Constructs the request
			const params = {
				RequestItems: {}
			};

			params.RequestItems[table] = PutRequests;

			return dynamodb
				.batchWriteItem(params)
				.promise()
				.then(function (batchResponse) {
					if (batchResponse.UnprocessedItems[table]) {
						// Keep the list of delays
						series.push(delay);

						delay = previous + anteprevious;

						anteprevious = previous;
						previous = delay;

						console.log(
							"%s unprocessed items",
							batchResponse.UnprocessedItems[table].length
						);
						console.log("Delaying next batch, %d seconds", delay);

						return Promise.delay(delay * 1000).then(function () {
							return deleteItems(batchResponse.UnprocessedItems[table]);
						});
					}

					// Revert the back of to the latest position
					// Not putting the back off to 0 to keep playing nicely
					if (series.length > 1) {
						previous = series.pop() || 0;
					}
				})
				.catch(function (err) {
					if (err.code === "ProvisionedThroughputExceededException") {
						console.log(
							"Provisioned Capacity error when deleting, delaying 15 seconds"
						);
						return Promise.delay(15 * 1000).then(function () {
							return deleteItems(PutRequests);
						});
					}

					throw err;
				});
		};

		// Returns a promise of the delete operation
		const deleteOperation = function (documentsToDelete) {
			const itemsToDelete = [];
			documentsToDelete.forEach(function (document) {
				const item = {};
				Object.keys(document).forEach(function (key) {
					if (keys.indexOf(key) > -1) {
						item[key] = utils.itemize(document[key]);
					}
				});

				itemsToDelete.push({
					DeleteRequest: {
						Key: item
					}
				});
			});

			return deleteItems(itemsToDelete);
		};

		// Contains arrays of $maxWriteItems items to save
		const chunkedDocuments = [];

		while (documents.length) {
			chunkedDocuments.push(documents.splice(0, maxWriteItems));
		}

		// Wait for all promises to be fulfilled one by one
		return Promise.each(chunkedDocuments, deleteOperation);
	};

	const update = function (table, document, conditions, keys, itemsToRemove) {
		// By default id will be the key
		if (!keys) {
			keys = ["id"];
		}

		const ExpressionAttributeNames = {};
		const ExpressionAttributeValues = {};
		const UpdateExpressions = [];

		Object.keys(document).forEach(function (key) {
			if (keys.indexOf(key) > -1) {
				return;
			}

			ExpressionAttributeNames["#" + key] = key;

			// Look for something like this: [!some_value]
			// This will make sure the value is not update if already set
			const conditional =
				typeof document[key] === "string" && /\[!(.*)\]/g.exec(document[key]);

			// Look for something like this: [++]
			// This will increment the value
			const increment = typeof document[key] === "string" && /\[\+\+\]/g.exec(document[key]);

			// Look for something like this: [--]
			// This will decrement the value
			const decrement = typeof document[key] === "string" && /\[--\]/g.exec(document[key]);

			if (conditional) {
				const value = isNaN(conditional[1]) ? conditional[1] : +conditional[1];

				ExpressionAttributeValues[":" + key] = utils.itemize(value);
				UpdateExpressions.push(
					"#" + key + " = " + "if_not_exists(#" + key + ", :" + key + ")"
				);
			} else if (increment) {
				ExpressionAttributeValues[":" + key] = utils.itemize(1);
				UpdateExpressions.push("#" + key + " = #" + key + " + :" + key);
			} else if (decrement) {
				ExpressionAttributeValues[":" + key] = utils.itemize(1);
				UpdateExpressions.push("#" + key + " = #" + key + " - :" + key);
			} else {
				ExpressionAttributeValues[":" + key] = utils.itemize(document[key]);
				UpdateExpressions.push("#" + key + " = " + ":" + key);
			}
		});

		const Key = {};
		keys.forEach(function (key) {
			Key[key] = utils.itemize(document[key]);
		});

		const params = {
			ReturnConsumedCapacity: "TOTAL",
			ReturnItemCollectionMetrics: "SIZE",
			ReturnValues: "ALL_NEW",
			Key: Key,
			ExpressionAttributeNames: ExpressionAttributeNames,
			ExpressionAttributeValues: ExpressionAttributeValues,
			UpdateExpression: "SET " + UpdateExpressions.join(", "),
			TableName: table
		};

		if (conditions && conditions.constructor === Object) {
			params.ConditionExpression = conditions.ConditionExpression;

			// Append condition values to ExpressionAttributeValues
			const values = conditions.ExpressionAttributeValues;
			Object.keys(values).forEach(function (key) {
				params.ExpressionAttributeValues[key] = utils.itemize(values[key]);
			});
		}

		if (itemsToRemove) {
			params.UpdateExpression += " REMOVE " + itemsToRemove.join(", ");
		}

		return dynamodb
			.updateItem(params)
			.promise()
			.then(function (result) {
				// Because ReturnValues is set to ALL_NEW, returned result reflects what is now in database.
				return utils.deitemize(result.Attributes);
			})
			.catch(function (err) {
				if (err.code === "ProvisionedThroughputExceededException") {
					console.log("Provisioned Capacity error when updating, delaying 15 seconds");
					return Promise.delay(15 * 1000).then(function () {
						return update(table, document, conditions, keys, itemsToRemove);
					});
				}

				throw err;
			});
	};

	const remove = function (table, document) {
		const key = {};
		Object.keys(document).forEach(function (k) {
			key[k] = utils.itemize(document[k]);
		});

		const params = {
			TableName: table,
			Key: key
		};

		return dynamodb.deleteItem(params).promise();
	};

	return {
		list: list,
		query: query,
		get: get,
		getItems: getItems,
		create: create,
		createItems: createItems,
		removeItems: removeItems,
		update: update,
		remove: remove
	};
};
