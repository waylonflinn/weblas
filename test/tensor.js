var tape = require('tape'),
	weblas = require('../index'),
	loader = require('floader'); // browserify aware file loader (xhr in browser)


var RTOL = 1e-05,
	ATOL = 1e-07;

tape("Tensor.transpose: 3 x 4", function(t){
	t.plan(2);

	var x = new Float32Array([ 1.0,  2.0,  3.0,  4.0,
							   5.0,  6.0,  7.0,  8.0,
							   9.0, 10.0, 11.0, 12.0]),
		expected = new Float32Array([ 1.0,  5.0,  9.0,
									  2.0,  6.0,  10.0,
									  3.0,  7.0,  11.0,
									  4.0,  8.0,  12.0]);

	var M = 3,
		N = 4;

	var t0 = new weblas.pipeline.Tensor([M, N], x),
		t1;

	try{
		// when tranposing texture for t0 is deleted by default
		t1 = t0.transpose();
		// when transfering texture for t1 is deleted by default
		var result = t1.transfer(true);
	}
	catch(ex){
		t.assert(false, ex);
		return;
	}

	weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

	// use internals to check that texture is padded correctly
	var pad = 1,
		padded;

	try{
		padded = weblas.test.padData(N, M, pad, expected);
		out = weblas.gpu.gl.createOutputTexture(N, M + pad);

		// float extraction
		weblas.gpu.encode(N, M + pad, t1.texture, out);
		result = new Float32Array(weblas.gpu.gl.readData(N, M + pad));

		weblas.gpu.gl.context.deleteTexture(out);
	}
	catch(ex){
		t.assert(false, ex);
	}

	weblas.test.assert.allclose(t, result, padded, null, RTOL, ATOL);
	t1.delete();
});

/*
weblas.test.load(testDirectory, matrixFiles, function(err, matrices){

	tape("Tensor.tranpose:", function(t){
		t.plan(1);

		var x = new Float32Array([1.0, 1.0, 1.0, 1.0]),
			expected = weblas.util.transpose(M, N, x);

		var t0 = new weblas.pipeline.Tensor([M, N], x),
			t1;


		try{
			// when tranposing texture for t0 is deleted by default
			t1 = t0.transpose();
			// when transfering texture for t1 is deleted by default
			var result = t1.transfer();
		}
		catch(ex){
			t.assert(false, ex);
			return;
		}

		weblas.test.assert.allclose(t, result, expected, null, RTOL, ATOL);

	});
});
*/
