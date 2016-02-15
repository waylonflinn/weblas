var WebGL = require('./webgl'),
	glslify = require('glslify');

/*  Linearize onto Kernels, a transformation similar to im2col, which
	transforms the input to a convolution kernel into a row.

	X - input data
	k - kernal width
	stride - number of elements between beginnings of patches


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SLOKNCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var p = glslify('./glsl/slokn/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SLOKNCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SLOKNCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SLOKNCalculator.STRIDE_UNIFORM_NAME = "stride";
SLOKNCalculator.KERNEL_WIDTH_UNIFORM_NAME = "factor";

/* Elementwise scale and offset a matrix

	M - number of rows in X
	N - number of columns in X
	a - scalar coefficient to X
	b - scalar offset of X
	X - matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SLOKNCalculator.prototype.calculate = function(M, N, channels, M_out, N_out, N_p, factor, stride, margin, X, out){

	var gl = this.webgl.context;

	var pad = this.webgl.getPad(N * channels),
		pad_out = this.webgl.getPad(N_out);

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SLOKNCalculator.TEXTURE_UNIFORM_NAME_0);

	// set the data specific variables in our shader program
	this.bindUniforms(M_out, N_out, pad_out, M, N * channels, channels, pad, N_p, factor, stride, margin);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M_out, N_out + pad_out, out);
	} else {
		this.webgl.bindOutputTexture(M_out, (N_out + pad_out)/ 4, out);
	}


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	texture - texture containing the data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SLOKNCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SLOKNCalculator.prototype.bindUniforms = function(M, N, pad, M_in, N_in, channels, pad_in, N_p, factor, stride, margin) {
	var gl = this.webgl.context;

	// get var locations
	var M_gl = gl.getUniformLocation(this.program, "M"),
		N_gl = gl.getUniformLocation(this.program, "N"),
		c_gl = gl.getUniformLocation(this.program, "C"),
		M_in_gl = gl.getUniformLocation(this.program, "M_in"),
		N_in_gl = gl.getUniformLocation(this.program, "N_in"),
		stride_gl = gl.getUniformLocation(this.program, SLOKNCalculator.STRIDE_UNIFORM_NAME),
		factor_gl = gl.getUniformLocation(this.program, SLOKNCalculator.KERNEL_WIDTH_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad"),
		pad_in_gl = gl.getUniformLocation(this.program, "pad_in"),
		N_p_gl = gl.getUniformLocation(this.program, "N_p");
		margin_gl = gl.getUniformLocation(this.program, "margin");

	// bind length of shared dimension
	gl.uniform1f(M_gl, M);
	gl.uniform1f(N_gl, N);
	gl.uniform1f(pad_gl, pad);
	gl.uniform1f(M_in_gl, M_in);
	gl.uniform1f(N_in_gl, N_in);
	gl.uniform1f(c_gl, channels);
	gl.uniform1f(pad_in_gl, pad_in);
	gl.uniform1f(N_p_gl, N_p);
	gl.uniform1f(factor_gl, factor);
	gl.uniform1f(stride_gl, stride);
	gl.uniform1f(margin_gl, margin);

};
