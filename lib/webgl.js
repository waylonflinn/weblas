var glslify = require('glslify');
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
	var passThrough = glslify('./glsl/pass_through.glsl');
	this.vertexShader = this.context.createShader(this.context.VERTEX_SHADER);
	this.context.shaderSource(this.vertexShader, passThrough);
	this.context.compileShader(this.vertexShader);

	var encode = glslify('./glsl/encode.glsl'),
		transpose = glslify('./glsl/transpose.glsl'),
		reshape = glslify('./glsl/reshape.glsl');

	this.encode_program = this.createProgram(encode);
	this.transpose_program = this.createProgram(transpose);
	this.reshape_program = this.createProgram(reshape);
};

module.exports = WebGL;

// RGBA is the standard input/ouput texture
WebGL.COMPONENTS_PER_TEXEL = 4;

WebGL.POSITION_UNIFORM_NAME = "pos";
WebGL.TEXTURE_UNIFORM_NAME = "tex";


WebGL.prototype.encode = function(M, N, texture0, out){

	this.program = this.encode_program;
	this.selectProgram(this.program);

	var pad = this.getPad(N);

	var N_gl = this.context.getUniformLocation(this.program, "N"),
		pad_gl = this.context.getUniformLocation(this.program, "pad");

	this.context.uniform1i(N_gl, N);
	this.context.uniform1i(pad_gl, pad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(M, N, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose = function(M, N, texture0, out){

	this.program = this.transpose_program;
	this.selectProgram(this.program);

	var npad = this.getPad(N),
		mpad = this.getPad(M);

	// in the shader M and N describe rows and columns in the *output*, respectively
	var N_gl = this.context.getUniformLocation(this.program, "N"),
		npad_gl = this.context.getUniformLocation(this.program, "npad"),
		M_gl = this.context.getUniformLocation(this.program, "M"),
		mpad_gl = this.context.getUniformLocation(this.program, "mpad");

	this.context.uniform1i(N_gl, M);
	this.context.uniform1i(npad_gl, mpad);
	this.context.uniform1i(M_gl, N);
	this.context.uniform1i(mpad_gl, npad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(N, (M + mpad)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.reshape = function(M, N, M_out, N_out, texture0, out){

	this.program = this.reshape_program;
	this.selectProgram(this.program);

	var pad = this.getPad(N),
		pad_out = this.getPad(N_out);

	// in the shader M and N describe rows and columns in the *output*, respectively
	var M_gl = this.context.getUniformLocation(this.program, "M"),
		N_gl = this.context.getUniformLocation(this.program, "N"),
		pad_gl = this.context.getUniformLocation(this.program, "pad"),
		M_in_gl = this.context.getUniformLocation(this.program, "M_in"),
		N_in_gl = this.context.getUniformLocation(this.program, "N_in"),
		pad_in_gl = this.context.getUniformLocation(this.program, "pad_in");

	this.context.uniform1f(M_gl, M_out);
	this.context.uniform1f(N_gl, N_out);
	this.context.uniform1f(pad_gl, pad_out);
	this.context.uniform1f(M_in_gl, M);
	this.context.uniform1f(N_in_gl, N);
	this.context.uniform1f(pad_in_gl, pad);

	this.bindInputTexture(texture0, this.context.TEXTURE0, "A");

	this.bindOutputTexture(M_out, (N_out + pad_out)/4, out);

	this.context.drawElements(this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0);

	this.unbindInputTexture(this.context.TEXTURE0);
};

WebGL.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

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

/* create RGBA texture of width w/4 from given texels
   padding the width of each row to a multiple of 4, where necessary.

   if texels is null, an empty texture is created.

   alternative to textures?
   http://stackoverflow.com/questions/17203508/webgl-hardware-skinning-with-a-bone-texture
 */
WebGL.prototype.createDataTexture = function(h, w, texels){

	var gl = this.context;

	var PAD_TEMPLATE = [0.0, 0.0, 0.0, 0.0]; // value to pad remainder with

	var rem = (w % WebGL.COMPONENTS_PER_TEXEL),
		pad = rem == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - rem;

	// create the texture from our floats
	var texture = gl.createTexture();

	gl.bindTexture(	  gl.TEXTURE_2D, texture);
	/*
	// https://www.opengl.org/wiki/GLAPI/glPixelStore
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w/4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

	see also: https://www.opengl.org/wiki/Common_Mistakes#Creating_a_complete_texture
	*/
	if(pad == 0 || texels == null || typeof texels === 'undefined'){
		// no padding required, write directly from input array
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, (w + pad) / WebGL.COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, texels);

	} else {
		// must pad each row

		// create empty texture
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, (w + pad) / WebGL.COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, null);

		var full_texel_row_len = w - rem,
			full_row_texture_width = full_texel_row_len / WebGL.COMPONENTS_PER_TEXEL;

		var row_start = 0;
		var last_texel = new Float32Array(PAD_TEMPLATE);
		var row, remainder;

		// set texture data, one row at a time, padding each row to a multiple
		// of the texel length
		for(var i = 0; i < h; i++){
			row_start = i * w;
			full_texel_row_end = row_start + full_texel_row_len;
			row = new Float32Array(texels.buffer, row_start * texels.BYTES_PER_ELEMENT, full_texel_row_len);
			if(full_texel_row_len > 0){
				// https://www.khronos.org/registry/webgl/specs/latest/1.0/index.html#TEXSUBIMAGE2D
				gl.texSubImage2D(gl.TEXTURE_2D,
					 0,					// mip-map level
					 0,					// x-offset
					 i,					// y-offset
					 full_row_texture_width,	// width
					 1,					// height
					 gl.RGBA,			// format
					 gl.FLOAT,			// type
					 row			// data
				 );
			}

			remainder = new Float32Array(texels.buffer, full_texel_row_end * texels.BYTES_PER_ELEMENT, rem);
			last_texel.set(remainder); // copy remaining data

			gl.texSubImage2D(gl.TEXTURE_2D,
				 0,				// mip-map level
				 full_row_texture_width, // x-offset
				 i,				// y-offset
				 1,				// width
				 1,				// height
				 gl.RGBA,		// format
				 gl.FLOAT,		// type
				 last_texel		// data
			 );
		}
	}

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return texture;
};

/* Create a (padded) texture suitable for reading into an array with readPixels.
	UNSIGNED_BYTE
   Can be passed to bindDestinationTexture.

   Returns an unsigned byte RGBA texture (other formats are not yet supported
	on most platforms, see WEBGL_color_buffer_float extension)
 */
WebGL.prototype.createOutputTexture = function(h, w) {
	var gl = this.context;

	var pad = this.getPad(w);

	// create and bind texture to render to
	var destTexture = gl.createTexture();
	//gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, destTexture);
	gl.texImage2D(gl.TEXTURE_2D,/*level*/0, gl.RGBA, w + pad, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return destTexture;
};

/* Set up output

	M - number of rows in output
	N - number of columns in output
	dstTex - texture for holding the output
 */
WebGL.prototype.bindOutputTexture = function(M, N, texture) {
	var gl = this.context;

	// set canvas and viewport size
	this.canvas.height = M;
	this.canvas.width = N;
	gl.viewport(0, 0, N, M);

	// create and bind framebuffer
	this.framebuffer = this.framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, /*level*/0);


	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
		throw new Error("Bound framebuffer is not complete.");

	return this.framebuffer;
};

WebGL.prototype.unbindInputTexture = function(textureUnit){
	var gl = this.context;

	gl.activeTexture(textureUnit);
	gl.bindTexture(gl.TEXTURE_2D, null);
};

/* Read data out as unsigned bytes */
WebGL.prototype.readData = function(M, N){
	var gl = this.context;

	// create destination buffer
	rawbuffer = new ArrayBuffer(M*N*Float32Array.BYTES_PER_ELEMENT);

	// read the result into our buffer, as bytes
	prod = new Uint8Array(rawbuffer);
	gl.readPixels(0, 0, N, M, gl.RGBA, gl.UNSIGNED_BYTE, prod);

	// return raw result bytes
	return rawbuffer; // M x N
};

// how many extra elements do we need to fill up a pixel?
WebGL.prototype.getPad = function(N){

	var rem = (N % WebGL.COMPONENTS_PER_TEXEL),
		pad = rem == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - rem;

	return pad;
};
