var WebGL = require('./webgl'),
	glslify = require('glslify');

/*  Elementwise clamp function for matrices on the interval [a, b]. Can also be
	used for min or max, by passing Number.MIN_VALUE for the first parameter and
	Number.MAX_VALUE for the second parameter, respectively.

	Passing `null` for either of these parameters will default to it's
	respective min or max value.

	max(a, min(b, x)) for each x in X

	where X is a matrix, a and b are scalars


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SCLMPCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = glslify('./glsl/sclmp/standalone.glsl'),
		p = glslify('./glsl/sclmp/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SCLMPCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SCLMPCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SCLMPCalculator.LENGTH_UNIFORM_NAME = "N";
SCLMPCalculator.LOWER_UNIFORM_NAME = "a";
SCLMPCalculator.UPPER_UNIFORM_NAME = "b";


/* Elementwise clamp a matrix to the interval [a, b]

	M - number of rows in X
	N - number of columns in X
	a - lower bound (inclusize)
	b - upper bound (inclusive)
	X - matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SCLMPCalculator.prototype.calculate = function(M, N, a, b, X, out){

	a = (a != null) ? a : Number.MIN_VALUE;
	b = (b != null) ? b : Number.MAX_VALUE;

	var gl = this.webgl.context;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SCLMPCalculator.TEXTURE_UNIFORM_NAME_0);

	var nPad = this.webgl.getPad(N);
	// set the data specific variables in our shader program
	this.bindUniforms(N, nPad, a, b);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + nPad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + nPad)/ 4, out);
	}

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);

};

/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SCLMPCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SCLMPCalculator.prototype.bindUniforms = function(N, pad, a, b) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SCLMPCalculator.LENGTH_UNIFORM_NAME),
		b_gl = gl.getUniformLocation(this.program, SCLMPCalculator.UPPER_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SCLMPCalculator.LOWER_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad");

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);
	gl.uniform1f(a_gl, a);
	gl.uniform1f(b_gl, b);

};
