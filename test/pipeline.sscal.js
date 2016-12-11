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
	ATOL = 1e-07;

var dataDirectory = 'test/data/sscal/',
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

			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				expected = matrices[1];

			if(!(X && X.length && X.length == m * n &&
				expected && expected.length && expected.length == m * n)){

				throw new Error("malformed data");
			}

			var t0 = new weblas.pipeline.Tensor([m, n], X),
				t3;

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				t3 = weblas.pipeline.sscal(a, b, t0);


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
			n = input[0]['shape'][1],
			a = (arg['a'] != null) ? arg['a'] : 1.0,
			b = (arg['b'] != null) ? arg['b'] : 0.0;

		//console.log("a: " + a + "; b: " + b);
		var testName = "pipeline.sscal: " + m + "x" + n + "; . " + a + " + " + b;
		tape(testName, generateTestCase(directory, m, n, a, b));
	}

});
