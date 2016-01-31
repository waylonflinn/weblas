var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

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

var matrixFiles = ['a.json', 'out.json'];

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
			var x = matrices[0],
				out = matrices[1];

			if(!(x && x.length && x.length == m * n &&
				out && out.length && out.length == m * n)){

				throw new Error("malformed data");
			}

			X = new Float32Array(x);
			expected = new Float32Array(out);


			var texture0 = weblas.gpu.gl.createDataTexture(m, n, X),
				texture3 = weblas.gpu.gl.createDataTexture(m, n, null);

			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				weblas.gpu.sscal(m, n, a, b, texture0, texture3);

				var out = weblas.gpu.gl.createOutputTexture(m, n);

				// float extraction
				weblas.gpu.encode(m, n, texture3, out);

				result = new Float32Array(weblas.gpu.gl.readData(m, n));
				//console.log(result.slice(0, 6));

				weblas.gpu.gl.context.deleteTexture(out);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

			if(pad > 0){
				var padded;

				try{
					padded = weblas.test.padData(m, n, pad, expected);
					out = weblas.gpu.gl.createOutputTexture(m, n + pad);

					// float extraction
					weblas.gpu.encode(m, n + pad, texture3, out);
					result = new Float32Array(weblas.gpu.gl.readData(m, n + pad));

					weblas.gpu.gl.context.deleteTexture(out);
				}
				catch(ex){
					t.assert(false, ex);
				}

				weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
			}


			weblas.gpu.gl.context.deleteTexture(texture0);
			weblas.gpu.gl.context.deleteTexture(texture3);
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
