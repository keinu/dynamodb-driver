const mockAWSSinon = require("mock-aws-sinon");

const SimpleDynamo = require("../index");

describe("Testing backoff", () => {
	jest.setTimeout(50000);

	describe("base test", () => {
		let i = 0;
		const items = [];

		while (i < 200) {
			items.push({
				something: "cool"
			});
			i++;
		}

		it("Remove should return UnprocessedItems", async () => {
			const database = new SimpleDynamo(
				{},
				{
					region: "eu-west-1",
					dynamodb: "2012-08-10"
				}
			);

			mockAWSSinon("DynamoDB", "batchWriteItem")
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(0)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(1)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(2)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(3)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(4)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(5)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(6)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(7)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(8)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(9)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(10)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(11)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(12)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(13)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(14)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(15)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				})
				.onCall(16)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(17)
				.returns({
					UnprocessedItems: {}
				})
				.onCall(18)
				.returns({
					UnprocessedItems: { test: items.splice(0, (Math.random() * 2) | 0) }
				});

			const result = await database.removeItems("test", items);

			expect(result).toBeDefined();
		});
	});
});
