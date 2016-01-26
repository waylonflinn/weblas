var WebGL = require('./webgl'),
	glslify = require('glslify');

/*  Downsample an image (useful in pooling layers).



	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function DownsampleCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = glslify('./glsl/sdwns/standalone.glsl');
		p = glslify('./glsl/sdwns/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = DownsampleCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
DownsampleCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
DownsampleCalculator.INPUT_ROW_COUNT_UNIFORM_NAME = "M";
DownsampleCalculator.INPUT_COLUMN_COUNT_UNIFORM_NAME = "N";
DownsampleCalculator.OUTPUT_ROW_COUNT_UNIFORM_NAME = "M_out";
DownsampleCalculator.OUTPUT_COLUMN_COUNT_UNIFORM_NAME = "N_out";
DownsampleCalculator.FACTOR_UNIFORM_NAME = "factor";
DownsampleCalculator.STRIDE_UNIFORM_NAME = "stride";
DownsampleCalculator.CHANNEL_COUNT_UNIFORM_NAME = "C";


/* Downsample (pool) the input using the maximum for each channel.

	M - rows in X
	N - columns in X
	c - (channels / 4) in X
	factor - the number of pixels (width and height) to combine
	stride - amount between groups of pixels
	X - input matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
DownsampleCalculator.prototype.calculate = function(M, N, channels, factor, stride, X, out){

	if(channels % WebGL.COMPONENTS_PER_TEXEL != 0){
		throw new Error("Channel count must be a multiple of " + WebGL.COMPONENTS_PER_TEXEL);
	}
	var gl = this.webgl.context;

    var N_out = (Math.floor((N - factor) / stride) + 1) * channels;
    var M_out = Math.floor((M - factor) / stride) + 1;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, DownsampleCalculator.TEXTURE_UNIFORM_NAME_0);


	// set the data specific variables in our shader program
	this.bindUniforms(M, N * channels, M_out, N_out, factor, stride, channels);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M_out, N_out, out);
	} else {
		this.webgl.bindOutputTexture(M_out, N_out/WebGL.COMPONENTS_PER_TEXEL, out);
	}


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	texture - texture containing input values to bind
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
DownsampleCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
DownsampleCalculator.prototype.bindUniforms = function(M, N, M_out, N_out, factor, stride, c) {
	var gl = this.webgl.context;

	// get var locations
	var M_gl = gl.getUniformLocation(this.program, DownsampleCalculator.INPUT_ROW_COUNT_UNIFORM_NAME),
		N_gl = gl.getUniformLocation(this.program, DownsampleCalculator.INPUT_COLUMN_COUNT_UNIFORM_NAME),
		M_out_gl = gl.getUniformLocation(this.program, DownsampleCalculator.OUTPUT_ROW_COUNT_UNIFORM_NAME),
		N_out_gl = gl.getUniformLocation(this.program, DownsampleCalculator.OUTPUT_COLUMN_COUNT_UNIFORM_NAME),
		factor_gl = gl.getUniformLocation(this.program, DownsampleCalculator.FACTOR_UNIFORM_NAME),
		stride_gl = gl.getUniformLocation(this.program, DownsampleCalculator.STRIDE_UNIFORM_NAME),
		channel_count_gl = gl.getUniformLocation(this.program, DownsampleCalculator.CHANNEL_COUNT_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1f(M_gl, M);
	gl.uniform1f(N_gl, N);
	gl.uniform1f(M_out_gl, M_out);
	gl.uniform1f(N_out_gl, N_out);
	gl.uniform1i(factor_gl, factor);
	gl.uniform1f(stride_gl, stride);
	gl.uniform1f(channel_count_gl, c);

};
