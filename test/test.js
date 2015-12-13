var chai = require("chai");
	chai.config.includeStack = true;

var chaiAsPromised = require("chai-as-promised");
	chai.use(chaiAsPromised);

var should = chai.should(),
	expect = chai.expect;

var AWS = require('mock-aws');

describe("SignatureService", function() {

    describe("Service invokation", function() {

    	SimpleDynamo = require('../index.js');
		database = new SimpleDynamo({}, {
		    region: "eu-west-1",
		    dynamodb: '2012-08-10'
		});

        it("Inokation should be ok", function() {
			expect(database).to.be.ok;
		});

    });

    describe("Database Query", function() {

		before(function() {

			this.timeout(5000);
			AWS.mock('DynamoDB', 'query', { Items: [
				{
					id: {"S": "string"},
					number: {"N": "1234"}
				}
     		]});


		});

		it("should return a correct query object", function(done) {

			query = database.query("ContainerUser", [{
				key: "user",
				operator: "EQ",
				value: "test"
			}], "user-index");

			query.should.eventually.be.fullfilled;
			query.should.eventually.have.have.length(1);
			query.should.eventually.have.deep.property("[0].id", "string");
			query.should.eventually.have.deep.property("[0].number", 1234).notify(done);

		});

	});

    describe("Databse list", function() {

    	before(function() {

    		this.timeout(5000);
			AWS.mock('DynamoDB', 'scan', { Items: [
				{
					id: {"S": "string"},
					number: {"N": "1234"}
				}
     		]});

    	});

		it("Should return the correct list", function(done) {

			this.timeout(5000);
			query = database.list("is-users", [{
				key: "email",
				operator: "EQ",
				value: "example@super.cool"
			}]);

			query.should.eventually.be.fullfilled;
			query.should.eventually.have.have.length(1);
			query.should.eventually.have.deep.property("[0].id", "string");
			query.should.eventually.have.deep.property("[0].number", 1234).notify(done);

		});

	});

    describe("Databse get", function() {

    	before(function() {

    		this.timeout(5000);
			AWS.mock('DynamoDB', 'getItem', { Item:
				{
					id: {"S": "string"},
					number: {"N": "1234"}
				}
			});

    	});

		it("Should return the correct list", function(done) {

			this.timeout(5000);
			query = database.get("is-users", "test");
			query.should.eventually.be.fullfilled;
			query.should.eventually.have.property("id", "string");
			query.should.eventually.have.property("number", 1234).notify(done);

		});

	});

	describe("Utils itemize", function() {

		var utils = require("../utils");

		it("Should execture a raound trip itemize - deitemize", function() {

			var original = {
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
