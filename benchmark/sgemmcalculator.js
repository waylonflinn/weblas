var Benchmark = require('benchmark'),
	tape = require('tape'),
	weblas = require('../index');

var suite = new Benchmark.Suite();

var pass = 0,
	fail = 0;

function createBenchmark(M, N, K){

	var alpha, A, B, beta, C;

	// default to square matrices, if only one length is provided
	N = N || M;
	K = K || M;
	var name = M + "x" + K + " . " + K + "x" + N;

	var b = new Benchmark(name, function(){
			result = weblas.sgemm(M, N, K, alpha, A, B, beta, null);
	})// add listeners
	.on('start', function(event){
		var a = test.randomArray(M, K);
		A = weblas.util.fromArray(a);
		B = weblas.util.fromArray(a);
	})
	.on('cycle', function(event) {
	})
	.on('complete', function(event) {

		var pm = '\xb1',
			mu = '\xb5'
			size = this.stats.sample.length;

        if(this.error){
        	console.log("not ok " + event.currentTarget.id + " " + this.name);
        	// show error
        	console.log("  ---");
        	console.log("  error: " + this.error);
        	console.log("  ...");

        	fail++;
        } else {

			var info = Benchmark.formatNumber(this.hz.toFixed(this.hz < 100 ? 2 : 0)) + ' ops/sec ' +
				' ' + pm + this.stats.rme.toFixed(2) + '% ' +
	         	' n = ' + size +
	        	' ' + mu + " = " + (this.stats.mean * 1000).toFixed(0) + 'ms';

			console.log("ok " + event.currentTarget.id + " " + this.name);
			console.log("# " + info);

			pass++;
        }


	});

	return b;
}

console.log("TAP version 13");

suite.add(createBenchmark(128));
suite.add(createBenchmark(128,  128,  256));
suite.add(createBenchmark(256));
suite.add(createBenchmark(512,  512,  256));
suite.add(createBenchmark(256,  256,  512));
suite.add(createBenchmark(512));
suite.add(createBenchmark(513,  513,  513));
suite.add(createBenchmark(1024, 1024, 512));
suite.add(createBenchmark(512,  512, 1024));
suite.add(createBenchmark(1024));
suite.add(createBenchmark(2048));

suite.on('complete', function(){
	console.log("\n1.." + suite.length);
	console.log("# tests " + suite.length);
	console.log("# pass  " + pass);
	if(fail)
		console.log("# fail  " + fail);
	else
		console.log("\n# ok\n");
});

// run async
suite.run({ 'async': true });
