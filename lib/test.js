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
	ATOL= ATOL || 1e-08;

	if(a.length != b.length){
		console.log("lengths not equal: " + a.length + ", " + b.length);
		return {"result" : false, "index": null};
	}

	var result;
	for(var i = 0; i < a.length; i++){

		result = Math.abs(a[i] - b[i]) <= ATOL + RTOL * Math.abs(b[i]);

		if(!result) {
			return {"result": false, "index": i};
		}
	}

	return {"result": true, "index": i};
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
// pad rows with zeros
test.padData = function(M, N, pad, data){

	var padded = new Float32Array(M * (N + pad)); // new array of specified length filled with zeros
	for(var i = 0; i < M; i++){
		padded.set(data.subarray(i * N, (i + 1) * N), i * (N + pad));
	}
	return padded;
}


/* Load test matrices from JSON data, works in a browser (with XHR)
	assumes three files 'a.json', 'b.json' and 'c.json' in nested Array format.

 callback = function(err, a, b, c)
 */
test.load = function(testDirectory, matrixFiles, callback){

	// array of paths to matrix data files for current test
	var testFiles = matrixFiles.map(function(item){ return testDirectory + item;});

	//console.log(testFiles);
	async.map(testFiles, loader.load,
		function(err, results){

			if(err) return callback(err);

			// results contains three strings.
			// each string contains the contents of a file
			// files contain JSON describing a matrix (2D array)
			var matrices = results.map(JSON.parse);

			callback(err, matrices);
		}
	);
};

test.assert = {};

/* create a tape compatible assert */
test.assert.allclose = function(t, a, b, msg, RTOL, ATOL) {

	var ok = test.allclose(a, b, RTOL, ATOL),
		actual = "[",
		expected = "[";

	if(!ok.result){

		if(ok.index > 1){
			actual += "..., ";
			expected += "..., ";
		}
		if(ok.index > 0){
			actual += a[ok.index - 1] + ", ";
			expected += b[ok.index - 1] + ", ";
		}
		actual += "-->";
		expected += "-->";

		for(var i = ok.index; i < ok.index + 4 && i < a.length; i++ ){
			actual += a[i] + ", ";
			expected += b[i] + ", ";
		}
		if(i < a.length){
			actual += "...]";
			expected += "...]";
		} else {
			actual += "]";
			expected += "]";
		}
		msg = msg || 'should be allclose at ' + ok.index;
	}

    t._assert(ok.result, {
        message : msg || 'should be allclose',
        operator : 'allclose',
        actual : actual,
        expected : expected,
        extra : null
    });
}

module.exports = test;
