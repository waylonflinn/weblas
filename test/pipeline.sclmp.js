var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');

// cd test/data/sgemm
// cp --parents 00*/a.json ../sstd
var RTOL = 1e-05,
	ATOL = 1e-07;

tape("pipeline.sclmp: 1x4", function(t){
	t.plan(1);

	var a = 2.0,
		X = new Float32Array([1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([2.0, 2.0, 2.0, 2.0]);

	var m = 1, n = 4, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	t0.delete();

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
tape("pipeline.sclmp: 1x3", function(t){
	t.plan(1);

	var a = 1.5,
		X = new Float32Array([1.0, 2.0, 3.0]),
		expected = new Float32Array([1.5, 2.0, 3.0]);

	var m = 1, n = 3, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}
	t0.delete();

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x3 (padding)", function(t){
	t.plan(1);

	var a = 1.5,
		X = new Float32Array([1.0, 2.0, 3.0]),
		expected = new Float32Array([1.5, 2.0, 3.0]);

	var m = 1, n = 3, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer(true);

		var pad = weblas.gpu.gl.getPad(n);

		var out = weblas.gpu.gl.createOutputTexture(m, n + pad);

		// float extraction
		weblas.gpu.encode(m, n + pad, t3.texture, out);

		var padded = new Float32Array(n + pad); // new array of specified length filled with zeros
		padded.set(expected);
		result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}
	t0.delete();
	t3.delete();

	weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x4", function(t){
	t.plan(1);

	var a = 0.0,
		X = new Float32Array([1.0, 2.0, 3.0, 4.0]),
		expected = new Float32Array([1.0, 2.0, 3.0, 4.0]);

	var m = 1, n = 4, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}
	t0.delete();

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x5", function(t){
	t.plan(1);

	var a = 2.2,
		X = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0]),
		expected = new Float32Array([2.2, 3.0, 2.2, 4.0, 7.0]);

	var m = 1, n = 5, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}
	t0.delete();

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x5 (padded)", function(t){
	t.plan(1);

	var a = 2.2,
		X = new Float32Array([1.0, 3.0, 2.0, 4.0, 7.0]),
		expected = new Float32Array([2.2, 3.0, 2.2, 4.0, 7.0]);

	var m = 1, n = 5, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer(true);

		var pad = weblas.gpu.gl.getPad(n);

		var out = weblas.gpu.gl.createOutputTexture(m, n + pad);

		// float extraction
		weblas.gpu.encode(m, n + pad, t3.texture, out);

		var padded = new Float32Array(n + pad); // new array of specified length filled with zeros
		padded.set(expected);
		result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x7", function(t){
	t.plan(1);

	var a = 0.0,
		X = new Float32Array([-1.0, 3.0, 2.0, -4.0, 7.0, -9.0, 11.0]),
		expected = new Float32Array([0.0, 3.0, 2.0, 0.0, 7.0, 0.0, 11.0]);

	var m = 1, n = 7, b = null;
	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer();
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}
	t0.delete();

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

tape("pipeline.sclmp: 1x7 (padded)", function(t){
	t.plan(1);

	var a = 0.0,
		X = new Float32Array([-1.0, 3.0, 2.0, -4.0, 7.0, -9.0, 11.0]),
		expected = new Float32Array([0.0, 3.0, 2.0, 0.0, 7.0, 0.0, 11.0]);

	var m = 1, n = 7, b = null;

	var t0 = new weblas.pipeline.Tensor([m, n], X),
		t3;

	try{
		t3 = weblas.pipeline.sclmp(a, b, t0);

		result = t3.transfer(true);

		var pad = weblas.gpu.gl.getPad(n);

		var out = weblas.gpu.gl.createOutputTexture(m, n + pad);

		// float extraction
		weblas.gpu.encode(m, n + pad, t3.texture, out);

		var padded = new Float32Array(n + pad); // new array of specified length filled with zeros
		padded.set(expected);
		result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);

});
var dataDirectory = 'test/data/sclmp/',
	testFile = 'small.json';

var gl = weblas.gpu.gl;

var matrixFiles = ['a.arr', 'out.arr'];

function generateTestCase(prefix, m, n, a, b){
	return function(t){

		var pad = weblas.gpu.gl.getPad(n);
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

			//console.log(matrices.length);
			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				expected = matrices[1];

			if(!(X && X.length && X.length == m * n &&
				 expected, expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([m, n], X),
				t3;

			try{
				t3 = weblas.pipeline.sclmp(a, b, t0);

				result = t3.transfer(true);

			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

			if(pad > 0){
				// use internals to check that texture is padded correctly
				var padded;

				try{
					padded = weblas.test.padData(m, n, pad, expected);
					out = weblas.gpu.gl.createOutputTexture(m, n + pad);

					// float extraction
					weblas.gpu.encode(m, n + pad, t3.texture, out);
					result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));
				}
				catch(ex){
					t.assert(false, ex);
				}

				weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
			}

			t0.delete();
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
			arg = test['arg'] || {};

		var m = input[0]['shape'][0],
			n = input[0]['shape'][1],
			a = (arg['a'] != null) ? arg['a'] : Number.MIN_VALUE,
			b = (arg['b'] != null) ? arg['b'] : Number.MAX_VALUE;

		//console.log("a: " + a + ", b: " + b);
		var testName = "pipeline.sclmp: " + m + "x" + n;
		tape(testName, generateTestCase(directory, m, n, a, b));
	}

});
