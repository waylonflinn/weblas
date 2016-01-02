/*
Copyright (c) 2015 Waylon Flinn

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

	var highp = this.context.getShaderPrecisionFormat(this.context.FRAGMENT_SHADER, this.context.HIGH_FLOAT);
	this.hasHighPrecision = highp.precision != 0;
	if(this.hasHighPrecision) this.highp = highp;

	// create pass through vertex shader
	this.vertexShader = this.context.createShader(this.context.VERTEX_SHADER);
	this.context.shaderSource(this.vertexShader, WebGL.PASS_THROUGH_VERTEX_SHADER);
	this.context.compileShader(this.vertexShader);

};

module.exports = WebGL;

WebGL.POSITION_UNIFORM_NAME = "pos";
WebGL.TEXTURE_UNIFORM_NAME = "tex";

WebGL.PASS_THROUGH_VERTEX_SHADER = "\
// vertex shader for a single quad                                           \n\
// work is performed in the operation specific texture shader                \n\
		                                                                     \n\
precision highp float;                                                       \n\
		                                                                     \n\
attribute vec3 pos;                                                         \n\
attribute vec2 tex;                                                         \n\
varying vec2   outTex;                                                         \n\
void main(void)                                                              \n\
{                                                                            \n\
	// just pass the position and texture coords                             \n\
	gl_Position = vec4(pos, 1.0);                                           \n\
	outTex = tex;                                                             \n\
}                                                                            \n\
";

/*  Create a shader program based on a pass through vertex shader and
	the supplied operation specific fragment shader.

	fragmentShaderSource - string containing the fragment shader source code.
	shader will recieve `vec2 outTex` with texture coordinates from the pass
	through vertex shader.
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

WebGL.prototype.selectProgram = function(program){

	var gl = this.context;

	// set calculator program to current shader program
	gl.useProgram(program);

	this.bindVertices(program);
};

/* setup required to draw a square to our vertex shader and have
   fragment shader called for each pixel
 */
WebGL.prototype.bindVertices = function(program) {
	var gl = this.context,
		renderer = program;

	// bind vertices
	var position = gl.getAttribLocation(renderer, WebGL.POSITION_UNIFORM_NAME);
	var vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

	// define a square that covers the screen
	var vertices = [-1.0, -1.0, 0.0,	// bottom left
					 1.0, -1.0, 0.0,	// bottom right
					 1.0,  1.0, 0.0,	// top right
					-1.0,  1.0, 0.0];	// top left
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(position, /*item size*/3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(position);

	// bind texture cords
	var texture = gl.getAttribLocation(renderer, WebGL.TEXTURE_UNIFORM_NAME);
	var texCoords = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
	var textureCoords = [0.0, 0.0,
						 1.0, 0.0,
						 1.0, 1.0,
						 0.0, 1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
	gl.vertexAttribPointer(texture, /*item size*/2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(texture);

	// index to vertices
	var indices = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
	// tesselate square into triangles
	// indeces into vertex array creating triangles, with counter-clockwise winding
	var vertexIndices = [0, 1, 2,	// bottom right triangle
						 0, 2, 3];	// top left triangle
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
};

/* Create and bind a texture to store the result.
   Requires canvas height and width be set to size of output matrix.
 */
WebGL.prototype.createDestinationTexture = function(h, w) {
	var gl = this.context;

	// create and bind texture to render to
	var destTexture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, destTexture);
	gl.texImage2D(gl.TEXTURE_2D,/*level*/0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	return destTexture;
};

/* Set up output

	M - number of rows in output
	N - number of columns in output
	dstTex - texture for holding the output
 */
WebGL.prototype.bindDestinationTexture = function(M, N, dstTex) {
	var gl = this.context;

	// set canvas and viewport size
	this.canvas.height = M;
	this.canvas.width = N;
	gl.viewport(0, 0, N, M);

	// create and bind renderbuffer
	this.renderbuffer = this.renderbuffer || gl.createRenderbuffer();

	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);

	gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16, N, M);

	// create and bind framebuffer
	this.framebuffer = this.framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dstTex,/*level*/0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.renderbuffer);

	return this.framebuffer;
};
