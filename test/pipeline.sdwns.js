var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)



var RTOL = 1e-05,
	ATOL = 1e-12;
// 0, 0
tape("pipeline.sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	var m = 2, n = 2, channels = 4, factor = 2, stride = 2;
	try{

		var N_out = Math.floor((n - factor) / stride) + 1;
		var M_out = Math.floor((m - factor) / stride) + 1;

		var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
			texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

		weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);


		var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

		// float extraction
		weblas.gpu.encode(M_out, N_out * channels, texture3, out);

		result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 02
// 1, 0
tape("pipeline.sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	var m = 2, n = 2, channels = 4, factor = 2, stride = 2;
	try{

		var N_out = Math.floor((n - factor) / stride) + 1;
		var M_out = Math.floor((m - factor) / stride) + 1;

		var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
			texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

		weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);


		var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

		// float extraction
		weblas.gpu.encode(M_out, N_out * channels, texture3, out);

		result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));

	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 03
// 0, 1
tape("pipeline.sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	var m = 2, n = 2, channels = 4, factor = 2, stride = 2;
	try{

		var N_out = Math.floor((n - factor) / stride) + 1;
		var M_out = Math.floor((m - factor) / stride) + 1;

		var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
			texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

		weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);


		var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

		// float extraction
		weblas.gpu.encode(M_out, N_out * channels, texture3, out);

		result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));

	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 04
// 1, 1
tape("pipeline.sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	var m = 2, n = 2, channels = 4, factor = 2, stride = 2;
	try{

		var N_out = Math.floor((n - factor) / stride) + 1;
		var M_out = Math.floor((m - factor) / stride) + 1;

		var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
			texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

		weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);


		var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

		// float extraction
		weblas.gpu.encode(M_out, N_out * channels, texture3, out);

		result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 1, 1?
tape("pipeline.sdwns: 2 x 2 x 8", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0,]),
		expected = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0  ]);

	var m = 2, n = 2, channels = 8, factor = 2, stride = 2;
	try{

		var N_out = Math.floor((n - factor) / stride) + 1;
		var M_out = Math.floor((m - factor) / stride) + 1;

		var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
			texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

		weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);

		var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

		// float extraction
		weblas.gpu.encode(M_out, N_out * channels, texture3, out);

		result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));

		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

var dataDirectory = 'test/data/sdwns/',
	testFile = 'small.json';

var matrixFiles = ['a.json', 'out.json'];

function generateTestCase(prefix, m, n, channels, factor, stride){

	return function(t){
		t.plan(1);

		var X, expected; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';


		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			//console.log(matrices.length);
			// matrices is an array which matches matrixFiles
			var x = matrices[0],
				out = matrices[1];

			if(!(x.length == m * n * channels &&
				out.length == (Math.floor((m - factor) / stride) + 1) *
							  (Math.floor((n - factor) / stride) + 1) * channels )){

				var message = "malformed data.";
				message += "expected {0} got {1}".format(m * n * channels, x.length);

				throw new Error(message);
			}

			X = new Float32Array(x);
			expected = new Float32Array(out);

			try{
				var N_out = Math.floor((n - factor) / stride) + 1;
				var M_out = Math.floor((m - factor) / stride) + 1;

				var texture0 = weblas.gpu.gl.createDataTexture(m, n * channels, X),
					texture3 = weblas.gpu.gl.createDataTexture(M_out, N_out * channels, null);

				weblas.gpu.sdwns(m, n, channels, factor, stride, texture0, texture3);

				var out = weblas.gpu.gl.createOutputTexture(M_out, N_out * channels);

				// float extraction
				weblas.gpu.encode(M_out, N_out * channels, texture3, out);

				result = new Float32Array(weblas.gpu.gl.readData(M_out, N_out * channels));

			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);
		});
	};
}

/*
tape("sdwns: 55 x 55 x 96", manualTestCase("0001", 55, 55, 96, 3, 2));

tape("sdwns: 27 x 27 x 256", manualTestCase("0002", 27, 27, 256, 3, 2));

tape("sdwns: 13 x 13 x 256", manualTestCase("0003", 13, 13, 256, 3, 2));
*/



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
			channels = input[0]['shape'][2],
			factor = test['arg']['factor'] || 2.0,
			stride = test['arg']['stride'] || 2.0;

		var testName = "pipeline.sdwns: " + m + "x" + n + "x" + channels;
		tape(testName, generateTestCase(directory, m, n, channels, factor, stride));
	}

});
