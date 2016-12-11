var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');

// cd test/data/sgemm
// cp --parents 00*/a.json ../sstd
var RTOL = 1e-05,
	ATOL = 1e-07;

tape("sscal: 1x4", function(t){
	t.plan(1);

	var a = 2.0,
		b = 1.5,
		x = new Float32Array([1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([3.5, 3.5, 3.5, 3.5]);

	try{
		result = weblas.sscal(1, 4, a, b, x);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
tape("sscal: 1x3", function(t){
	t.plan(1);

	var a = 2.0,
		b = 1.5,
		x = new Float32Array([1.0, 2.0, 3.0]),
		expected = new Float32Array([3.5, 5.5, 7.5]);

	try{
		result = weblas.sscal(1, 3, a, b, x);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("sscal: 1x4", function(t){
	t.plan(1);

	var a = 2.0,
		b = 1.5,
		x = new Float32Array([1.0, 2.0, 3.0, 4.0]),
		expected = new Float32Array([3.5, 5.5, 7.5, 9.5]);

	try{
		result = weblas.sscal(1, 4, a, b, x);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("sscal: 1x5", function(t){
	t.plan(1);

	var a = 3.2,
		b = 5.6,
		x = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0]),
		expected = new Float32Array([8.8, 15.2, 12.0, 18.4, 28.0]);

	try{
		result = weblas.sscal(1, 5, a, b, x);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("sscal: 1x7", function(t){
	t.plan(1);

	var a = 3.2,
		b = 5.6,
		x = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0, 9.0, 11.0]),
		expected = new Float32Array([8.8, 15.2, 12.0, 18.4, 28.0, 34.4, 40.8]);

	try{
		result = weblas.sscal(1, 7, a, b, x);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

var dataDirectory = 'test/data/sscal/',
	testFile = 'small.json';

var matrixFiles = ['a.arr', 'out.arr'];

function generateTestCase(prefix, m, n, a, b){
	return function(t){
		t.plan(1);

		var X, expected; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';


		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			if(err){
				console.log(err);
				return;
			}

			//console.log(matrices.length);
			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				expected = matrices[1];

			if(!(X && X.length && X.length == m * n &&
				 expected, expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sscal(m, n, a, b, X);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
		});
	};
}

loader.load(dataDirectory + testFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(var i = 0; i < suite.length; i++){

		directory = String("0000" + (i + 1)).slice(-4);

		var test = suite[i];

		var input = test['in'],
			sizes = input['shape'],
			arg = test['arg'] || {};

		var m = input[0]['shape'][0],
			n = input[0]['shape'][1],
			a = (arg['a'] != null) ? arg['a'] : 1.0,
			b = (arg['b'] != null) ? arg['b'] : 0.0;

		//console.log("generating " + directory);
		var testName = "sscal: " + m + "x" + n;
		tape(testName, generateTestCase(directory, m, n, a, b));
	}

});
