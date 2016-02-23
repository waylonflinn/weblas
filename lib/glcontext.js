var headless = require('gl');

function Context(options){
	this.options = options.gl;
}

module.exports = Context;

Context.prototype.getContext = function(N, M){
	return headless(N, M, this.options);
}
