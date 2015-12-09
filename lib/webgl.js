/*
Copyright (c) 2015 Waylon Flinn

some parts Copyright (c) 2014 Jonathan Watmough

webgl.js

multiply matrices up to 4096 x 4096 on GPUs that support OES_texture_float
extension. input is encoded into the red and green channels of an input texture and
calculations are done using a custom fragment shader.

*/


/*
	A WebGL context associated with a specific canvas element.

	* creates a canvas
	* sets up webgl context
	* translates numbers into textures
	* compiles shader programs for executing math (when supplied with an
		operation specific fragment shader)
 */
function WebGL(options) {

	var glOptions,
		ext;

	options = options || {};

	// canvas
	if(typeof options.canvas === 'undefined')
		this.canvas = document.createElement('canvas');
	else
		this.canvas = options.canvas;

	// context
	glOptions = { premultipliedAlpha: false, preserveDrawingBuffer: false };
	this.context = this.canvas.getContext("experimental-webgl", glOptions);

	if (typeof this.context === 'undefined')
		throw new Error("No support for Webgl.");

	// float texture extension
	try {
		ext = this.context.getExtension('OES_texture_float');
	} catch(e) {

	}
	if ( !ext ) {
		console.log("No support for OES_texture_float extension.");
		this.hasFloat = false;
	} else {
		this.hasFloat = true;
	}

	// create pass through vertex shader
	this.vertexShader = this.context.createShader(this.context.VERTEX_SHADER);
	this.context.shaderSource(this.vertexShader, WebGL.PASS_THROUGH_VERTEX_SHADER);
	this.context.compileShader(this.vertexShader);

};

module.exports = WebGL;

WebGL.PASS_THROUGH_VERTEX_SHADER = "\
// vertex shader for a single quad                                           \n\
// work is performed based on the texels being passed through                \n\
// the operation specific texture shader.                                    \n\
#ifdef GL_ES                                                                 \n\
precision highp float;                                                       \n\
#endif                                                                       \n\
attribute vec3 aPos;                                                         \n\
attribute vec2 aTex;                                                         \n\
varying vec2   vTex;                                                         \n\
void main(void)                                                              \n\
{                                                                            \n\
	// just pass the position and texture coords                             \n\
	gl_Position = vec4(aPos, 1.0);                                           \n\
	vTex = aTex;                                                             \n\
}                                                                            \n\
";

/*  Create a shader program based on a pass through vertex shader and
	the supplied operation specific fragment shader.

	fragmentShaderSource - string containing the fragment shader source code.
 */
WebGL.prototype.createProgram = function(fragmentShaderSource){
	var gl = this.context,
		fragmentShader;

	// compile the provided fragment/texture shader
	fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// did it compile correctly?
	if (gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) == 0)
		throw new Error(gl.getShaderInfoLog(fragmentShader));

	// link the program specific fragment shader and the generic pass through
	// shader into a program
	var program = gl.createProgram();
	gl.attachShader(program, this.vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	return program;
};

/* Create and bind a texture to store the result.
   Requires canvas height and width be set to size of output matrix.
 */
WebGL.prototype.createDestinationTexture = function() {
	var gl = this.context;

	// create and bind texture to render to
	var destTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, destTexture);
	gl.texImage2D(gl.TEXTURE_2D,/*level*/0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);

	return destTexture;
};

/* create a typed array from a 2D javascript array */
WebGL.fromArray = function(array, type, tranpose) {
	var shape = [],
			data,
			c;   // number of columns

	if(!tranpose){
		shape[0] = array.length;
		shape[1] = array[0].length;
	} else {
		shape[1] = array.length;
		shape[0] = array[0].length;
	}
	c = shape[1];

	type = type || Float32Array;

	data = new type(shape[0]*shape[1]);

	for (var ii = 0; ii < shape[0]; ++ii)
		for (var jj = 0; jj < shape[1]; ++jj)
		if(!tranpose)
			data[ii*c + jj] = array[ii][jj];
		else
			data[ii*c + jj] = array[jj][ii];

	return data;
};
