
function Context(options){

	// canvas
	if(typeof options.canvas === 'undefined')
		this.canvas = document.createElement('canvas');
	else
		this.canvas = options.canvas;


	this.context = this.canvas.getContext("experimental-webgl", options.gl);

	if (typeof this.context === 'undefined')
		throw new Error("No support for Webgl.");

}

module.exports = Context;

Context.prototype.getContext = function(N, M){

	var self = this;

	this.context.resize = function(N, M){
		self.canvas.height = M;
		self.canvas.width = N;
	}

	return this.context;
};
