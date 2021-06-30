const AWS = require("aws-sdk-mock");

const ddbriver = require("../index");
const utils = require("../utils");

describe("Node simple dynamo", () => {
	const mockDynamoDbQuery = jest.fn();
	const mockDynamoDbScan = jest.fn();
	const mockDynamoDbGetItem = jest.fn();
	const mockDynamoDbBatchGetItem = jest.fn();

	beforeEach(() => {
		AWS.mock("DynamoDB", "query", mockDynamoDbQuery);
		AWS.mock("DynamoDB", "scan", mockDynamoDbScan);
		AWS.mock("DynamoDB", "getItem", mockDynamoDbGetItem);
		AWS.mock("DynamoDB", "batchGetItem", mockDynamoDbBatchGetItem);
	});

	afterEach(() => {
		AWS.restore();
	});

	describe("Database Query", () => {
		beforeEach(() => {
			mockDynamoDbQuery.mockResolvedValue({
				Items: [
					{
						id: { S: "string" },
						number: { N: "1234" }
					}
				]
			});
		});

		it("should return a correct query object", async () => {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			const result = await database.query(
				"ContainerUser",
				[
					{
						key: "user",
						operator: "EQ",
						value: "test"
					}
				],
				"user-index"
			);
			expect(result).toEqual([{ id: "string", number: 1234 }]);
		});
	});

	describe("Database list", () => {
		beforeEach(() => {
			mockDynamoDbScan.mockResolvedValue({
				Items: [
					{
						id: { S: "string" },
						number: { N: "1234" }
					}
				]
			});
		});

		it("Should return the correct list", async () => {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			const result = await database.list("is-users", [
				{
					key: "email",
					operator: "EQ",
					value: "example@super.cool"
				}
			]);
			expect(result).toEqual([{ id: "string", number: 1234 }]);
		});
	});

	describe("Database get", () => {
		beforeEach(() => {
			mockDynamoDbGetItem.mockResolvedValue({
				Item: {
					id: { S: "string" },
					number: { N: "1234" }
				}
			});
		});

		it("Should return the correct object item", async () => {
			const database = new ddbriver({
				region: "eu-west-1",
				dynamodb: "2012-08-10"
			});

			const result = await database.get("is-users", "test");
			expect(result).toEqual({ id: "string", number: 1234 });
		});
	});

	describe("Database get Items", () => {
		const documents = [
			{
				id: "123",
				prop1: "prop1",
				prop2: "prop2"
			}
		];

		beforeEach(() => {
			mockDynamoDbBatchGetItem.mockResolvedValue({
				Responses: {
					TABLE_NAME: utils.itemize(documents).L
				},
				UnprocessedKeys: {
					TABLE_NAME: null
				}
			});
		});

		describe("with ids as an array of objects", () => {
			it("Should return the correct list", async () => {
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

				const result = await database.getItems("TABLE_NAME", ids, {
					keys: ["partition", "sort"]
				});
				expect(result).toEqual(documents);
			});
		});

		describe("with ids as an array of strings", () => {
			it("Should return the correct list", async () => {
				const database = new ddbriver({
					region: "eu-west-1",
					dynamodb: "2012-08-10"
				});

				const ids = ["123", "456"];

				const result = await database.getItems("TABLE_NAME", ids, {});
				expect(result).toEqual(documents);
			});
		});
	});
});
