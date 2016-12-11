var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');


var RTOL = 1e-05,
	ATOL = 1e-12;
// 0, 0
tape("sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	try{
		result = weblas.sdwns(2, 2, 4, 2, 2, X);
		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 02
// 1, 0
tape("sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	try{
		result = weblas.sdwns(2, 2, 4, 2, 2, X);
		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 03
// 0, 1
tape("sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	try{
		result = weblas.sdwns(2, 2, 4, 2, 2, X);
		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 04
// 1, 1
tape("sdwns: 2 x 2 x 4", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0]),
		expected = new Float32Array([	1.0, 2.0, 1.0, 1.0 ]);

	try{
		result = weblas.sdwns(2, 2, 4, 2, 2, X);
		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});
// 1, 1?
tape("sdwns: 2 x 2 x 8", function(t){
	t.plan(1);

	var X = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
								1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0,]),
		expected = new Float32Array([	1.0, 1.0, 1.0, 1.0, 1.0, 2.0, 1.0, 1.0  ]);

	try{
		result = weblas.sdwns(2, 2, 8, 2, 2, X);
		//console.log(result);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

});

var matrixFiles = ['a.arr', 'out.arr'];
var dataDirectory = 'test/data/sdwns/';

function generateTestCase(prefix, m, n, channels, factor, stride){

	return function(t){
		t.plan(1);

		var X, C; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';


		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			//console.log(matrices.length);
			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				C = matrices[1];
			if(!(X.length == m * n * channels &&
				C.length == (Math.floor((m - factor) / stride) + 1) *
							(Math.floor((n - factor) / stride) + 1) * channels )){

				var message = "malformed data.";
				message += "expected {0} got {1}".format(m * n * channels, x.length);

				throw new Error(message);
			}


			//console.log(m + "x" + k + " times " + k + "x" + n);

			try{
				result = weblas.sdwns(m, n, channels, factor, stride, X);
			}
			catch(ex){
				t.assert(false, ex);
				return;
			}

			weblas.test.assert.allclose(t, result, C, null, RTOL, ATOL);
		});
	};
}

/*
tape("sdwns: 55 x 55 x 96", manualTestCase("0001", 55, 55, 96, 3, 2));

tape("sdwns: 27 x 27 x 256", manualTestCase("0002", 27, 27, 256, 3, 2));

tape("sdwns: 13 x 13 x 256", manualTestCase("0003", 13, 13, 256, 3, 2));
*/


var dataDirectory = 'test/data/sdwns/',
	testFile = 'small.json';

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

		var testName = "sdwns: " + m + "x" + n + "x" + channels;
		tape(testName, generateTestCase(directory, m, n, channels, factor, stride));
	}

});
