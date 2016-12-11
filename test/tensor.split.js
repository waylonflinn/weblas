var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');

var RTOL = 1e-05,
	ATOL = 1e-07;

// reusing data from sscal
var dataDirectory = 'test/data/sscal/',
	testFile = 'small.json';

var gl = weblas.gpu.gl;

var matrixFiles = ['a.arr'];


tape("Tensor.split: 8 x 8", function(t){
	t.plan(2);

	var x = new Float32Array([ 1.0,  2.0,  3.0,  4.0,  5.0,  6.0,  7.0,  8.0,
							   9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0,
							  17.0, 18.0, 19.0, 20.0, 21.0, 22.0, 23.0, 24.0,
							  25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0,
							  33.0, 34.0, 35.0, 36.0, 37.0, 38.0, 39.0, 40.0,
							  41.0, 42.0, 43.0, 44.0, 45.0, 46.0, 47.0, 48.0,
							  49.0, 50.0, 51.0, 52.0, 53.0, 54.0, 55.0, 56.0,
							  57.0, 58.0, 59.0, 60.0, 61.0, 62.0, 63.0, 64.0]),
		e1 = new Float32Array([  1.0,  2.0,  3.0,  4.0,
								 9.0, 10.0, 11.0, 12.0,
								17.0, 18.0, 19.0, 20.0,
								25.0, 26.0, 27.0, 28.0,
								33.0, 34.0, 35.0, 36.0,
								41.0, 42.0, 43.0, 44.0,
								49.0, 50.0, 51.0, 52.0,
								57.0, 58.0, 59.0, 60.0,]),

		e2 = new Float32Array([  5.0,  6.0,  7.0,  8.0,
								13.0, 14.0, 15.0, 16.0,
								21.0, 22.0, 23.0, 24.0,
								29.0, 30.0, 31.0, 32.0,
								37.0, 38.0, 39.0, 40.0,
								45.0, 46.0, 47.0, 48.0,
								53.0, 54.0, 55.0, 56.0,
								61.0, 62.0, 63.0, 64.0]);

	var M = 8, N = 8,
		t0 = new weblas.pipeline.Tensor([M, N], x),
		t1, t2;

	try{
		// when splitting texture for t0 is deleted by default
		submatrices = t0.split(4);
		t1 = submatrices[0];
		t2 = submatrices[1];
		// when transfering texture for t1 is deleted by default
		var result = t1.transfer();
	}
	catch(ex){
		t.error(ex);
		return;
	}

	weblas.test.assert.allclose(t, result, e1, null, RTOL, ATOL);
	var result = t2.transfer();
	weblas.test.assert.allclose(t, result, e2, null, RTOL, ATOL);
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

var matrixFiles = ['a.arr', 'a0.arr', 'a1.arr'];

var m = 27,
	n = 27,
	channels = 96;
var testDirectory = "./test/data/split/" + "0001" + '/';

//console.log("a: " + a + "; b: " + b);
var testName = "Tensor.split: " + m + "x" + n + "x" + channels;
tape(testName, generateSplitTestCase(testDirectory, m, n * channels, channels));


testDirectory = "./test/data/split/" + "0002" + '/';
var testName = "Tensor.split: " + m + "x" + n + "x" + channels;
tape(testName, generateSplitTestCase(testDirectory, m, n * channels, channels));

m = 13;
n = 13;
channels = 384;
testDirectory = "./test/data/split/" + "0003" + '/';
var testName = "Tensor.split: " + m + "x" + n + "x" + channels;
tape(testName, generateSplitTestCase(testDirectory, m, n * channels, channels));

m = 13;
n = 13;
channels = 384;
testDirectory = "./test/data/split/" + "0004" + '/';
var testName = "Tensor.split: " + m + "x" + n + "x" + channels;
tape(testName, generateSplitTestCase(testDirectory, m, n * channels, channels));


function generateSplitTestCase(testDirectory, M, N, channels){
	return function(t){

		var X, expected0, expected1; // typed arrays

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			if(err){
				t.skip("Unable to load files: " + err.message);
				t.end();

				return;
			}

			var pad = weblas.gpu.gl.getPad(N / 2);
			if(pad == 0){
				t.plan(2);
			} else {
				t.plan(4);
			}

			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				expected0 = matrices[1],
				expected1 = matrices[2];

			if(!(X && X.length && X.length == M * N)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([M, N], X),
				t1, t2;

			var result;
			try{
				// when splitting texture for t0 is deleted by default
				submatrices = t0.split(channels / 2);
				t1 = submatrices[0];
				t2 = submatrices[1];
			}
			catch(ex){
				t.error(ex);
				t.end();
				return;
			}


			result = t1.transfer(true);

			testWithPad(t, M, N / 2, pad, result, expected0, t1.texture, RTOL, ATOL);
			t1.delete();


			result = t2.transfer(true);

			testWithPad(t, M, N / 2, pad, result, expected1, t2.texture, RTOL, ATOL);

			t2.delete();

		});
	};
}
