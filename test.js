var SimpleDynamo = require("./index.js");
var db = SimpleDynamo({}, {
    region: "eu-west-1"
});

var shortid = require('shortid');

var write = function() {

	var i;
	var checks = [];

	for (i = 0; i < 30; i++) {

		var hrTime = process.hrtime();

		checks.push({
			// id: shortid.generate(),
			// service: "just a test service",
			// reportId: "Whatever",
			// ccrn: "qwerqwegwlerkgw e;rlkg werlgkw ergwerg",
			date: new Date().getTime().toString() + hrTime[1]
		});

	}

	console.log(JSON.stringify(checks, null, 2));

	// db.createItems("Check", checks).then(function() {
	// 	console.log("done");
	// });

};

write();
