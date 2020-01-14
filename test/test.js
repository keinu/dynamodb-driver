var Promise = require("bluebird");
var proxyquire = require("proxyquire");

var chai = require("chai");
var should = chai.should(),
	expect = chai.expect;

var utils = require("../utils.js");

describe("Node simple dynamo", function() {

    describe("Service invocation", function() {

    	SimpleDynamo = require('../index.js');
		database = new SimpleDynamo({
		    region: "eu-west-1",
		    dynamodb: '2012-08-10'
		});

        it("Inokation should be ok", function() {
			expect(database).to.be.ok;
		});

    });

    describe("Database Query", function() {

    	var ddbriver;

		before(function() {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function() {
						return {
							query: function(params) {

								return {
									promise: () => Promise.resolve({ Items: [{
										id: {"S": "string"},
										number: {"N": "1234"}
									}]})
								};

							}
						};
					}
				}
			});
		});

		it("should return a correct query object", function() {

			database = new ddbriver({
			    region: "eu-west-1",
			    dynamodb: '2012-08-10'
			});

			return database.query("ContainerUser", [{
				key: "user",
				operator: "EQ",
				value: "test"
			}], "user-index").then(function(data) {

				data.should.have.length(1);
				data.should.have.deep.property("[0].id", "string");
				data.should.have.deep.property("[0].number", 1234);

			});

		});

	});

    describe("Databse list", function() {

    	var ddbriver;

		before(function() {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function() {
						return {
							scan: function(params) {

								return {
									promise: () => Promise.resolve({ Items: [{
										id: {"S": "string"},
										number: {"N": "1234"}
									}]})
								};

							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function() {

			database = new ddbriver({
			    region: "eu-west-1",
			    dynamodb: '2012-08-10'
			});

			return database.list("is-users", [{
				key: "email",
				operator: "EQ",
				value: "example@super.cool"
			}]).then(function(data) {

				data.should.have.length(1);
				data.should.have.deep.property("[0].id", "string");
				data.should.have.deep.property("[0].number", 1234);

			});

		});

	});

    describe("Databse get", function() {

		before(function() {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function() {
						return {
							getItem: function(params) {

								return {
									promise: () => Promise.resolve({ Item: {
										id: {"S": "string"},
										number: {"N": "1234"}
									}})
								};

							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function() {

			database = new ddbriver({
			    region: "eu-west-1",
			    dynamodb: '2012-08-10'
			});

			return database.get("is-users", "test").then(function(data) {

				data.should.have.property("id", "string");
				data.should.have.property("number", 1234);

			});

		});

	});

	describe("Databse get Items with ids as input", function() {

		let documents = [{
			id: "123",
			prop1: "prop1",
			prop2: "prop2"
		}];

		before(function() {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function() {
						return {
							batchGetItem: function(params) {

								return {
									promise: () => Promise.resolve({
										Responses: {
											"TABLE_NAME": utils.itemize(documents).L
										},
										UnprocessedKeys: {
											"TABLE_NAME": null
										}
									})
								};

							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function(	) {

			database = new ddbriver({
			    region: "eu-west-1",
			    dynamodb: '2012-08-10'
			});

			let ids = [{
				"partition": "123",
				"sort": "ABC"
			}, {
				"partition": "234",
				"sort": "DEF"
			}];

			return database.getItems("TABLE_NAME", ids, {keys: ["partition", "sort"]}).then(function(data) {

				data.should.be.deep.equal(documents);

			});

		});

	});

	describe("Databse get Items with ids as input", function() {

		let documents = [{
			id: "123",
			prop1: "prop1",
			prop2: "prop2"
		}];

		before(function() {
			ddbriver = proxyquire(__basePath + "/index.js", {
				"aws-sdk": {
					DynamoDB: function() {
						return {
							batchGetItem: function(params) {

								return {
									promise: () => Promise.resolve({
										Responses: {
											"TABLE_NAME": utils.itemize(documents).L
										},
										UnprocessedKeys: {
											"TABLE_NAME": null
										}
									})
								};

							}
						};
					}
				}
			});
		});

		it("Should return the correct list", function() {

			database = new ddbriver({
			    region: "eu-west-1",
			    dynamodb: '2012-08-10'
			});

			let ids = ["123", "456"];

			return database.getItems("TABLE_NAME", ids, {}).then(function(data) {

				data.should.be.deep.equal(documents);

			});
		});

	});

	describe("Utils itemize", function() {

		var utils = require("../utils");

		it("Should execture a raound trip itemize - deitemize", function() {

			var original = {
				"null-value": null,
				string: "string",
				number: 1234,
				arrayOfNumbers: [1,2,3,4,5],
				arrayofStrings: ["a", "b", "c", "d", "e"],
				object: {
					property1: "value1",
					property2: "value2"
				},
				arrayObject: [{
					string: "string",
					number: 1234,
					arrayOfNumbers: [1,2,3,4,5],
					arrayofStrings: ["a", "b", "c", "d", "e"],
					object: {
						property1: "value1",
						property2: "value2"
					}
				}]
			};

			var result = utils.itemize(original);
			expect(original).to.deep.equal(utils.deitemize(result));

		});

		it("Should execute a round trip with deitemize - itemize", function() {

			var original = {
			  "M": {
			  	"null-value": {
			  		"NULL": true
			  	},
			    "string": {
			      "S": "string"
			    },
			    "number": {
			      "N": "1234"
			    },
			    "arrayOfNumbers": {
			      "NS": [
			        "1",
			        "2",
			        "3",
			        "4",
			        "5"
			      ]
			    },
			    "arrayofStrings": {
			      "SS": [
			        "a",
			        "b",
			        "c",
			        "d",
			        "e"
			      ]
			    },
			    "object": {
			      "M": {
			        "property1": {
			          "S": "value1"
			        },
			        "property2": {
			          "S": "value2"
			        }
			      }
			    },
			    "arrayObject": {
			      "L": [
			        {
			          "M": {
			            "string": {
			              "S": "string"
			            },
			            "number": {
			              "N": "1234"
			            },
			            "arrayOfNumbers": {
			              "NS": [
			                "1",
			                "2",
			                "3",
			                "4",
			                "5"
			              ]
			            },
			            "arrayofStrings": {
			              "SS": [
			                "a",
			                "b",
			                "c",
			                "d",
			                "e"
			              ]
			            },
			            "object": {
			              "M": {
			                "property1": {
			                  "S": "value1"
			                },
			                "property2": {
			                  "S": "value2"
			                }
			              }
			            }
			          }
			        }
			      ]
			    }
			  }
			};

			var result = utils.deitemize(original);
			expect(original).to.deep.equal(utils.itemize(result));

		});

	});

});
