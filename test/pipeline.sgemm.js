var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');

/*  run in a browser with testling

		browserify test/*.js | testling -x google-chrome

	on Ubuntu, requires

		sudo apt-get install xvfb
 */


var RTOL = 1e-05,
	ATOL = 1e-12;

var dataDirectory = 'test/data/sgemm/',
	testFile = 'small.json';

function single(){
	tape("1x1 . 1x4", function(t){
		t.plan(1);

		var alpha = 1.0,
			beta = 1.0,
			A = new Float32Array([1.0]),
			B = new Float32Array([1.0, 1.0, 1.0, 1.0]),
			C = new Float32Array([2.0, 2.0, 2.0, 2.0]),
			expected = new Float32Array([3.0, 3.0, 3.0, 3.0]);

		var t0 = new weblas.pipeline.Tensor([1, 1], A),
			t1 = new weblas.pipeline.Tensor([4, 1], B),
			t2 = new weblas.pipeline.Tensor([1, 4], C);

		try{
			t3 = weblas.pipeline.sgemm(alpha, t0, t1, beta, t2);

			// get the result, but retain the texture (for padding check)
			result = t3.transfer(true);
			//console.log(result.slice(0, 6));

		}
		catch(ex){
			t.assert(false, ex);
			return;
		}

		weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

		t0.delete();
		t1.delete();
		t2.delete();
	});
}
var matrixFiles = ['a.arr', 'b.arr', 'out.arr'];

function generateTestCase(prefix, m, n, k, alpha){
	return function(t){
		var pad = weblas.gpu.gl.getPad(n);
		if(pad == 0){
			t.plan(1);
		} else {
			t.plan(2);
		}

		var A, B, expected; // typed arrays

		// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var A = matrices[0],
				B = matrices[1],
				expected = matrices[2];

			if(!(A && A.length && A.length == m * k &&
				B && B.length && B.length == k * n &&
				expected && expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([m, k], A),
				t1 = new weblas.pipeline.Tensor([n, k], weblas.util.transpose(k, n, B)),
				t3;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				t3 = weblas.pipeline.sgemm(alpha, t0, t1, null, null);

				// get the result, but retain the texture (for padding check)
				result = t3.transfer(true);
				//console.log(result.slice(0, 6));

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

					weblas.gpu.gl.context.deleteTexture(out);
				}
				catch(ex){
					t.assert(false, ex);
				}

				weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
			}

			t0.delete();
			t1.delete();
			t3.delete();
		});
	};
}

var extendedMatrixFiles = ['a.arr', 'b.arr', 'c.arr', 'out.arr'];

function generateExtendedTestCase(prefix, m, n, k, alpha, beta, transposed){
	return function(t){
		var pad = weblas.gpu.gl.getPad(n);
		if(pad == 0){
			t.plan(1);
		} else {
			t.plan(2);
		}

		var A, B, C, expected; // typed arrays

		// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';

		// load matrices from files
		weblas.test.load(testDirectory, extendedMatrixFiles, function(err, matrices){

			// matrices is an array which matches matrixFiles
			var A = matrices[0],
				B = matrices[1],
				C = matrices[2],
				expected = matrices[3];

			if(!(A && A.length && A.length == m * k &&
				B && B.length && B.length == k * n &&
				expected && expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([m, k], A),
				t1 = new weblas.pipeline.Tensor([n, k], transposed ? B : weblas.util.transpose(k, n, B)),
				t2 = new weblas.pipeline.Tensor([1, n], C),
				t3;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				t3 = weblas.pipeline.sgemm(alpha, t0, t1, beta, t2);

				// get the result, but retain the texture (for padding check)
				result = t3.transfer(true);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			var ok;
			ok = weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
			/*
			if(!ok && download){
				// dump result

				console.log("dumping result");
				download(result, "result.arr", "application/octet-stream");
			}*/


			if(pad > 0){
				var padded;

				try{
					padded = weblas.test.padData(m, n, pad, expected);
					out = weblas.gpu.gl.createOutputTexture(m, n + pad);

					// float extraction
					weblas.gpu.encode(m, n + pad, t3.texture, out);
					result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));

					weblas.gpu.gl.context.deleteTexture(out);
				}
				catch(ex){
					t.assert(false, ex);
					return;
				}

				weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
			}

			t0.delete();
			t1.delete();
			t2.delete();
			t3.delete();
		});
	};
}

loader.load(dataDirectory + testFile, function(err, config){

	single();

	var suite = JSON.parse(config);

	// suite configuration file uses directory name as key
	for(var i = 0; i < suite.length; i++){

		directory = String("0000" + (i + 1)).slice(-4);

		var test = suite[i];

		var input = test['in'],
			arg = test['arg'] || {};

		// get base matrix dimensions
		var m1 = input[0]['shape'][0],
			n1 = input[0]['shape'][1],
			m2 = input[1]['shape'][0],
			n2 = input[1]['shape'][1];

		var m = m1,
			transposed;

		// is the second matrix already transposed?
		if(n1 === m2){
			transposed = false;
			k = m2;
			n = n2;
		} else if(n1 === n2){
			transposed = true;
			k = n2;
			n = m2;
		} else {
			throw new Error("Matrices not compatible");
		}

		var alpha = (arg['alpha'] != null) ? arg['alpha'] : 1.0,
			beta = (arg['beta'] != null) ? arg['beta'] : 1.0;

		var testName = "pipeline.sgemm: " + m + "x" + k + " . " + k + "x" + n;
		if(input.length == 2){
			tape(testName, generateTestCase(directory, m, n, k, alpha, null, transposed));
		} else {
			testName += " + 1x" + n;
			tape(testName, generateExtendedTestCase(directory, m, n, k, alpha, beta, transposed));
		}
	}

});
