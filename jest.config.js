module.exports = {
	clearMocks: true,
	restoreMocks: true,
	resetModules: true,
	testEnvironment: "node",
	testPathIgnorePatterns: ["<rootDir>/node_modules", "<rootDir>/runners"],
	coveragePathIgnorePatterns: ["<rootDir>/test/mocks"],
	collectCoverageFrom: ["index.js", "utils.js"],
	coverageReporters: ["json", "lcov", "json-summary", "text"],
	coverageThreshold: {
		global: {
			statements: 46,
			branches: 44,
			functions: 46,
			lines: 46
		}
	}
};
