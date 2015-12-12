var async = require('async'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

/* Collection of helper methods for testing numerical computation
 */
test = {};

/* Check all entries in two TypedArrays of identical length for approximate
	equality.
	If the following equation is element-wise true, returns true

	absolute(a - b) <= (atol + rtol * absolute(b))

	from numpy.allclose
 */
test.allclose = function(a, b, RTOL, ATOL){
	RTOL= RTOL || 1e-05;  // for 32 bit precision: 1e-06
	ATOL= ATOL || 1e-12;

	if(a.length != b.length){
		console.log("lengths not equal: " + a.length + ", " + b.length);
		return false;
	}

	var result;
	for(var i = 0; i < a.length; i++){

		result = Math.abs(a[i] - b[i]) <= ATOL + RTOL * Math.abs(b[i]);

		if(!result) return result;
	}

	return true;
};

test.randomArray = function(N, M){

	var data = [];

	for(var i = 0; i < N; i++){
		var row = [];
		for(var j = 0; j < M; j++){
			row[j] = Math.random() / Math.sqrt(N);
		}
		data.push(row);
	}

	return data;
};

var matrixFiles = ['a.json', 'b.json', 'c.json'];

/* Load test matrices from JSON data, works in a browser (with XHR)
	assumes three files 'a.json', 'b.json' and 'c.json' in nested Array format.

 callback = function(err, a, b, c)
 */
test.load = function(testDirectory, callback){

	var a, b, c; // javascript arrays

	// array of paths to matrix data files for current test
	var testFiles = matrixFiles.map(function(item){ return testDirectory + item;});

	//console.log(testFiles);
	async.map(testFiles, loader.load,
		function(err, results){

			if(err) return callback(err);

			// results contains three strings.
			// each string contains the contents of a file
			// files contain JSON describing a matrix (2D array)
			a = JSON.parse(results[0]);
			b = JSON.parse(results[1]);
			c = JSON.parse(results[2]);

			callback(err, a, b, c);
		}
	);
};

module.exports = test;
