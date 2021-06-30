const utils = require("../utils");

describe("Utils", () => {
	describe("itemize", () => {
		it("Should execute a round trip itemize - deitemize", () => {
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
			expect(original).toEqual(utils.deitemize(result));
		});

		it("Should execute a round trip with deitemize - itemize", () => {
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
			expect(original).toEqual(utils.itemize(result));
		});
	});
});
