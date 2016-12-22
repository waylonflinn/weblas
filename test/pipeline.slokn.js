var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)

weblas.test = require('../lib/test');


var RTOL = 1e-05,
	ATOL = 1e-12;


var dataDirectory = 'test/data/slokn/',
	testFile = 'small.json';

var matrixFiles = ['a.arr', 'out.arr'];

function generateTestCase(prefix, M, N, channels, factor, stride, margin){

	return function(t){


		var X, expected; // typed arrays

			// directory containing matrix data files for current test
		var testDirectory = dataDirectory + prefix + '/';


		// load matrices from files
		weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

			if(err){
				t.skip("Unable to load files: " + err.message);
				t.end();

				return;
			}

			var pad = weblas.gpu.gl.getPad(factor * factor * channels);
			if(pad == 0){
				t.plan(1);
			} else {
				t.plan(2);
			}

			//console.log(M, N, channels);
			// matrices is an array which matches matrixFiles
			var X = matrices[0],
				expected = matrices[1];
			var M_out = (Math.ceil((M - factor) / stride) + 1) *
						(Math.ceil((N - factor) / stride) + 1);
			var N_out = factor * factor * channels;

			if(margin > 0){
				M_out = (Math.ceil((M + (2 * margin) - factor) / stride) + 1) *
						(Math.ceil((N + (2 * margin) - factor) / stride) + 1);
			}
			if(!(X.length == M * N * channels &&
				expected.length ==  M_out * N_out)){

				var message = "malformed data.";
				message += "expected {0} and {1} got {2} and {3}".format(M * N * channels, M_out * N_out, X.length, expected.length);

				throw new Error(message);
			}

			var t0 = new weblas.pipeline.Tensor([M, N * channels], X),
				t3;

			try{

				t3 = weblas.pipeline.slokn(channels, factor, stride, margin, t0);

			}
			catch(ex){
				t.error(ex);
				if(pad != 0) t.notOk(false, "skipping padding test");

				return;
			}

			result = t3.transfer(true);
			testWithPad(t, t3.shape[0], t3.shape[1], pad, result, expected, t3.texture, RTOL, ATOL);
			t3.delete();


		});
	};
}


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
/*
tape("sdwns: 55 x 55 x 96", manualTestCase("0001", 55, 55, 96, 3, 2));

tape("sdwns: 27 x 27 x 256", manualTestCase("0002", 27, 27, 256, 3, 2));

tape("sdwns: 13 x 13 x 256", manualTestCase("0003", 13, 13, 256, 3, 2));
*/


var margin = 0;
var m = 224,
	n = 224,
	channels = 3,
	factor = 11,
	stride = 4;

var testName = "pipeline.slokn: " + m + "x" + n + "x" + channels;
tape(testName, generateTestCase("0001", m, n, channels, factor, stride, margin));
tape(testName, generateTestCase("0002", m, n, channels, factor, stride, margin));
tape(testName, generateTestCase("0003", m, n, channels, factor, stride, margin));

margin = 1;
m = 13;
n = 13;
channels = 256;
factor = 3;
stride = 1;
/* 169, 2304 */

testName = "pipeline.slokn: " + m + "x" + n + "x" + channels + " + " + margin;
tape(testName, generateTestCase("0004", m, n, channels, factor, stride, margin));

channels = 192;
/* 169, 1728 */
testName = "pipeline.slokn: " + m + "x" + n + "x" + channels + " + " + margin;
tape(testName, generateTestCase("0005", m, n, channels, factor, stride, margin));

testName = "pipeline.slokn: " + m + "x" + n + "x" + channels + " + " + margin;
tape(testName, generateTestCase("0006", m, n, channels, factor, stride, margin));

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
