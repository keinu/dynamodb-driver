const Promise = require("bluebird");
const proxyquire = require("proxyquire");

const chai = require("chai");
const expect = chai.expect;

chai.should();

const utils = require("../utils");

const __basePath = process.env.PWD;
global.__basePath = process.env.PWD;

describe("Node simple dynamo", function () {
	describe("Service invocation", function () {
		const SimpleDynamo = require("../index");
		const database = new SimpleDynamo({
			region: "eu-west-1",
			dynamodb: "2012-08-10"
		});

		it("Invocation should be ok", function () {
			expect(database).to.be.ok;
		});
	});

	describe("Database Query", function () {
		let ddbriver;

		before(function () {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function () {
						return {
							query: function () {
								return {
									promise: () =>
										Promise.resolve({
											Items: [
												{
													id: { S: "string" },
													number: { N: "1234" }
												}
											]
										})
								};
							}
						};
					}
				}
			});
		});

		it("should return a correct query object", function () {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			return database
				.query(
					"ContainerUser",
					[
						{
							key: "user",
							operator: "EQ",
							value: "test"
						}
					],
					"user-index"
				)
				.then(function (data) {
					data.should.have.length(1);
					data.should.have.deep.property("[0].id", "string");
					data.should.have.deep.property("[0].number", 1234);
				});
		});
	});

	describe("Databse list", function () {
		let ddbriver;

		before(function () {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function () {
						return {
							scan: function () {
								return {
									promise: () =>
										Promise.resolve({
											Items: [
												{
													id: { S: "string" },
													number: { N: "1234" }
												}
											]
										})
								};
							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function () {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			return database
				.list("is-users", [
					{
						key: "email",
						operator: "EQ",
						value: "example@super.cool"
					}
				])
				.then(function (data) {
					data.should.have.length(1);
					data.should.have.deep.property("[0].id", "string");
					data.should.have.deep.property("[0].number", 1234);
				});
		});
	});

	describe("Databse get", function () {
		let ddbriver;

		before(function () {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function () {
						return {
							getItem: function () {
								return {
									promise: () =>
										Promise.resolve({
											Item: {
												id: { S: "string" },
												number: { N: "1234" }
											}
										})
								};
							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function () {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			return database.get("is-users", "test").then(function (data) {
				data.should.have.property("id", "string");
				data.should.have.property("number", 1234);
			});
		});
	});

	describe("Databse get Items with ids as input", function () {
		const documents = [
			{
				id: "123",
				prop1: "prop1",
				prop2: "prop2"
			}
		];
		let ddbriver;

		before(function () {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function () {
						return {
							batchGetItem: function () {
								return {
									promise: () =>
										Promise.resolve({
											Responses: {
												TABLE_NAME: utils.itemize(documents).L
											},
											UnprocessedKeys: {
												TABLE_NAME: null
											}
										})
								};
							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function () {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			const ids = [
				{
					partition: "123",
					sort: "ABC"
				},
				{
					partition: "234",
					sort: "DEF"
				}
			];

			return database
				.getItems("TABLE_NAME", ids, { keys: ["partition", "sort"] })
				.then(function (data) {
					data.should.be.deep.equal(documents);
				});
		});
	});

	describe("Databse get Items with ids as input", function () {
		const documents = [
			{
				id: "123",
				prop1: "prop1",
				prop2: "prop2"
			}
		];
		let ddbriver;

		before(function () {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function () {
						return {
							batchGetItem: function () {
								return {
									promise: () =>
										Promise.resolve({
											Responses: {
												TABLE_NAME: utils.itemize(documents).L
											},
											UnprocessedKeys: {
												TABLE_NAME: null
											}
										})
								};
							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function () {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			const ids = ["123", "456"];

			return database.getItems("TABLE_NAME", ids, {}).then(function (data) {
				data.should.be.deep.equal(documents);
			});
		});
	});

	describe("Utils itemize", function () {
		it("Should execute a round trip itemize - deitemize", function () {
			const original = {
				"null-value": null,
				string: "string",
				number: 1234,
				arrayOfNumbers: [1, 2, 3, 4, 5],
				arrayOfStrings: ["a", "b", "c", "d", "e"],
				object: {
					property1: "value1",
					property2: "value2"
				},
				arrayObject: [
					{
						string: "string",
						number: 1234,
						arrayOfNumbers: [1, 2, 3, 4, 5],
						arrayOfStrings: ["a", "b", "c", "d", "e"],
						object: {
							property1: "value1",
							property2: "value2"
						}
					}
				]
			};

			const result = utils.itemize(original);
			expect(original).to.deep.equal(utils.deitemize(result));
		});

		it("Should execute a round trip with deitemize - itemize", function () {
			const original = {
				M: {
					"null-value": {
						NULL: true
					},
					string: {
						S: "string"
					},
					number: {
						N: "1234"
					},
					arrayOfNumbers: {
						NS: ["1", "2", "3", "4", "5"]
					},
					arrayofStrings: {
						SS: ["a", "b", "c", "d", "e"]
					},
					object: {
						M: {
							property1: {
								S: "value1"
							},
							property2: {
								S: "value2"
							}
						}
					},
					arrayObject: {
						L: [
							{
								M: {
									string: {
										S: "string"
									},
									number: {
										N: "1234"
									},
									arrayOfNumbers: {
										NS: ["1", "2", "3", "4", "5"]
									},
									arrayofStrings: {
										SS: ["a", "b", "c", "d", "e"]
									},
									object: {
										M: {
											property1: {
												S: "value1"
											},
											property2: {
												S: "value2"
											}
										}
									}
								}
							}
						]
					}
				}
			};

			const result = utils.deitemize(original);
			expect(original).to.deep.equal(utils.itemize(result));
		});
	});
});
