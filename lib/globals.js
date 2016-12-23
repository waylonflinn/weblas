var WebGL = require("./webgl");

var gl;
try{
	gl = new WebGL();
} catch (e){
	gl = null;
	console.log('No support for WebGL!');
}

module.exports = {
	"gl" : gl
}
