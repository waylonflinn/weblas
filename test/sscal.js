var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

// cd test/data/sgemm
// cp --parents 00*/a.json ../sstd
var RTOL = 1e-05,
	ATOL = 1e-07;

var dataDirectory = 'test/data/sscal/',
	testFile = 'small.json';

tape("sscal: 1x4", function(t){
	t.plan(1);

	var a = 2.0,
		x = new Float32Array([1.0, 1.0, 1.0, 1.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 3.5, 3.5, 3.5]);

	try{
		result = weblas.sscal(1, 4, a, x, y);
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
		x = new Float32Array([1.0, 2.0, 3.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 5.5, 7.5]);

	try{
		result = weblas.sscal(1, 3, a, x, y);
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
		x = new Float32Array([1.0, 2.0, 3.0, 4.0]),
		y = 1.5,
		expected = new Float32Array([3.5, 5.5, 7.5, 9.5]);

	try{
		result = weblas.sscal(1, 4, a, x, y);
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
		x = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0]),
		y = 5.6,
		expected = new Float32Array([8.8, 15.2, 12.0, 18.4, 28.0]);

	try{
		result = weblas.sscal(1, 5, a, x, y);
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
		x = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0, 9.0, 11.0]),
		y = 5.6,
		expected = new Float32Array([8.8, 15.2, 12.0, 18.4, 28.0, 34.4, 40.8]);

	try{
		result = weblas.sscal(1, 7, a, x, y);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

var matrixFiles = ['a.json', 'out.json'];

function generateTestCase(prefix, a, b){
	return function(t){
		t.plan(1);

		var X, C; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';


		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			//console.log(matrices.length);
			// matrices is an array which matches matrixFiles
			var x = matrices[0],
				c = matrices[1];

			if(!(x[0] && x[0].length && x.length == c.length &&
				 x[0].length == c[0].length ))
				throw new Error("malformed data");

			X = weblas.util.fromArray(x);
			C = weblas.util.fromArray(c);

			var m = x.length,
				n = x[0].length;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sscal(m, n, a, X, b);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, C, null, RTOL, ATOL);
		});
	};
}

loader.load(dataDirectory + testFile, function(err, config){

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(var i = 0; i < suite.length; i++){

		directory = String("0000" + (i + 1)).slice(-4);

		var test = suite[i];
		test['arg'] = test['arg'] || {};

		var input = test['in'],
			sizes = input['shape'];

		var m = input[0]['shape'][0],
			n = input[0]['shape'][1],
			a = test['arg']['a'] || 1.0,
			b = test['arg']['b'] || 0.0;

		//console.log("generating " + directory);
		tape("sscal: " + m + "x" + n, generateTestCase(directory, a, b));
	}

});
