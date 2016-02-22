var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)


var RTOL = 1e-05,
	ATOL = 1e-07;

// reusing data from sscal
var dataDirectory = 'test/data/sscal/',
	testFile = 'small.json';

var gl = weblas.gpu.gl;

var matrixFiles = ['a.arr'];

tape("Tensor.combine: 8 x 8", function(t){
	t.plan(1);
	var x1 = new Float32Array([  1.0,  2.0,  3.0,  4.0,
								 9.0, 10.0, 11.0, 12.0,
								17.0, 18.0, 19.0, 20.0,
								25.0, 26.0, 27.0, 28.0,
								33.0, 34.0, 35.0, 36.0,
								41.0, 42.0, 43.0, 44.0,
								49.0, 50.0, 51.0, 52.0,
								57.0, 58.0, 59.0, 60.0,]),
		x2 = new Float32Array([  5.0,  6.0,  7.0,  8.0,
								13.0, 14.0, 15.0, 16.0,
								21.0, 22.0, 23.0, 24.0,
								29.0, 30.0, 31.0, 32.0,
								37.0, 38.0, 39.0, 40.0,
								45.0, 46.0, 47.0, 48.0,
								53.0, 54.0, 55.0, 56.0,
								61.0, 62.0, 63.0, 64.0]),
		expected = new Float32Array([ 1.0,  2.0,  3.0,  4.0,  5.0,  6.0,  7.0,  8.0,
									   9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0,
									  17.0, 18.0, 19.0, 20.0, 21.0, 22.0, 23.0, 24.0,
									  25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0,
									  33.0, 34.0, 35.0, 36.0, 37.0, 38.0, 39.0, 40.0,
									  41.0, 42.0, 43.0, 44.0, 45.0, 46.0, 47.0, 48.0,
									  49.0, 50.0, 51.0, 52.0, 53.0, 54.0, 55.0, 56.0,
									  57.0, 58.0, 59.0, 60.0, 61.0, 62.0, 63.0, 64.0]);


	var M = 8, N = 4,
		t1 = new weblas.pipeline.Tensor([M, N], x1),
		t2 = new weblas.pipeline.Tensor([M, N], x2);

	try{
		// when splitting texture for t0 is deleted by default
		t0 = weblas.pipeline.Tensor.combine(t1, t2, N);
		// when transfering texture for t1 is deleted by default
		var result = t0.transfer();
	}
	catch(ex){
		t.error(ex);

		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
});

/*
tape("Tensor.combine: 8 x 6", function(t){
	t.plan(1);
	var x1 = new Float32Array([  1.0,  2.0,  3.0,
								 9.0, 10.0, 11.0,
								17.0, 18.0, 19.0,
								25.0, 26.0, 27.0,
								33.0, 34.0, 35.0,
								41.0, 42.0, 43.0,
								49.0, 50.0, 51.0,
								57.0, 58.0, 59.0]),
		x2 = new Float32Array([  5.0,  6.0,  7.0,
								13.0, 14.0, 15.0,
								21.0, 22.0, 23.0,
								29.0, 30.0, 31.0,
								37.0, 38.0, 39.0,
								45.0, 46.0, 47.0,
								53.0, 54.0, 55.0,
								61.0, 62.0, 63.0]),
		expected = new Float32Array([ 1.0,  2.0,  3.0,  5.0,  6.0,  7.0,
									   9.0, 10.0, 11.0, 13.0, 14.0, 15.0,
									  17.0, 18.0, 19.0, 21.0, 22.0, 23.0,
									  25.0, 26.0, 27.0, 29.0, 30.0, 31.0,
									  33.0, 34.0, 35.0, 37.0, 38.0, 39.0,
									  41.0, 42.0, 43.0, 45.0, 46.0, 47.0,
									  49.0, 50.0, 51.0, 53.0, 54.0, 55.0,
									  57.0, 58.0, 59.0, 61.0, 62.0, 63.0]);


	var M = 8, N = 3,
		t1 = new weblas.pipeline.Tensor([M, N], x1),
		t2 = new weblas.pipeline.Tensor([M, N], x2);

	try{
		// when splitting texture for t0 is deleted by default
		t0 = weblas.pipeline.Tensor.combine(t1, t2);
		// when transfering texture for t1 is deleted by default
		var result = t0.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
});
*/

function generateSplitCombineTestCase(prefix, M, N){
	return function(t){
		var pad = weblas.gpu.gl.getPad(N);
		if(pad == 0){
			t.plan(1);
		} else {
			t.plan(2);
		}

		var X, expected; // typed arrays

		// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			if(err){
				t.error(err);
				if(pad != 0) t.notOk(false, "skipping padding test");

				return;
			}

			// matrices is an array which matches matrixFiles
			var X = matrices[0];

			if(!(X && X.length && X.length == M * N)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([M, N], X),
				t1, t2, t3;

			var expected = X;
			try{
				// when splitting texture for t0 is deleted by default
				submatrices = t0.split();
				t1 = submatrices[0];
				t2 = submatrices[1];
				t3 = weblas.pipeline.Tensor.combine(t1, t2);
			} catch(ex){
				t.error(ex);
				if(pad != 0) t.notOk(false, "skipping padding test");

				return;
			}


			// when transfering texture for t1 is deleted by default
			var result = t3.transfer(true);

			testWithPad(t, M, N, pad, result, expected, t3.texture, RTOL, ATOL);
			t3.delete();

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
			n = input[0]['shape'][1];

		if(n % 2 !== 0)
			continue;

		//console.log("a: " + a + "; b: " + b);
		var testName = "Tensor.split+combine: " + m + "x" + n;
		tape(testName, generateSplitCombineTestCase(directory, m, n));
	}

});

function testWithPad(t,  M, N, pad, result, expected, texture, RTOL, ATOL){

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

	if(pad > 0){

		// use internals to check that texture is padded correctly
		var padded;

		try{
			padded = weblas.test.padData(M, N, pad, expected);
			out = weblas.gpu.gl.createOutputTexture(M, N + pad);

			// float extraction
			weblas.gpu.encode(M, N + pad, texture, out);
			result = new Float32Array(weblas.gpu.gl.readData(M, N + pad));

			weblas.gpu.gl.context.deleteTexture(out);
		}
		catch(ex){
			t.assert(false, ex);
		}

		weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
	}
}
