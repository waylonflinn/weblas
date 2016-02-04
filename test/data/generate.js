#!/usr/bin/env node
var spawn = require('child_process').spawn,
	async = require('async');


/*
./generate.py sscal/ sscal/small.json
./generate.py sgemm/ sgemm/small.json
./generate.py sdwns/ sdwns/small.json
./generate.py sclmp/ sclmp/small.json
*/

var tasks = [
	['generate.py', 'sscal/', 'sscal/small.json'],
	['generate.py', 'sgemm/', 'sgemm/small.json'],
	['generate.py', 'sdwns/', 'sdwns/small.json'],
	['generate.py', 'sclmp/', 'sclmp/small.json']
];
var options = {
    "cwd" : __dirname,
    "stdio": ["inherit", "inherit", "inherit"]};


async.eachSeries(tasks, function(task, callback){
		spawn('python', task, options).on('close', callback);
	},
	function(){
		// all done
});
