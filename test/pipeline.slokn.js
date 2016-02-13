var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)



var RTOL = 1e-05,
	ATOL = 1e-12;


var dataDirectory = 'test/data/slokn/',
	testFile = 'small.json';

var matrixFiles = ['a.arr', 'out.arr'];

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
			var X = matrices[0],
				expected = matrices[1];

			if(!(X.length == m * n * channels &&
				expected.length == (Math.ceil((m - factor) / stride) + 1) *
							  (Math.ceil((n - factor) / stride) + 1) * factor * factor * channels )){

				var message = "malformed data.";
				message += "expected {0} got {1}".format(m * n * channels, X.length);

				throw new Error(message);
			}


			var t0 = new weblas.pipeline.Tensor([m, n * channels], X),
				t3;

			try{

				t3 = weblas.pipeline.slokn(channels, factor, stride, t0);

				result = t3.transfer();
				console.log(result.slice(0, 16));

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


var m = 224,
	n = 224,
	channels = 3,
	factor = 11,
	stride = 4;

var directory = "0001";

var testName = "pipeline.slokn: " + m + "x" + n + "x" + channels;
tape(testName, generateTestCase(directory, m, n, channels, factor, stride));
/*
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
*/
