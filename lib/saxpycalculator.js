var WebGL = require('./webgl'),
	glslify = require('glslify');

/* A calculator object for the Float texture based AXPY

	a times X plus Y (AXPY):

	Y = a * X + Y

	where X + Y is elementwise matrix addition


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SAXPYCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = standalone || true; // default to standalone mode


	var s = glslify('./glsl/saxpy/standalone.glsl');
	//	p = glslify('./glsl/saxpy/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SAXPYCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SAXPYCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SAXPYCalculator.TEXTURE_UNIFORM_NAME_1 = "Y";
SAXPYCalculator.LENGTH_UNIFORM_NAME = "N";
SAXPYCalculator.COEFFICIENT_UNIFORM_NAME = "a";


/* Calculate the AXPY, with the given data.

	N - number of elements in X and Y
	a - scalar coefficient to X
	X - left hand vector (texture)
	Y - right hand vector (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 */
SAXPYCalculator.prototype.calculate = function(N, a, X, Y, out){

	var gl = this.webgl.context;

	/*
	var h1 = M, w1 = K,
		h2 = K, w2 = N;
	*/

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SAXPYCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(Y, gl.TEXTURE1, SAXPYCalculator.TEXTURE_UNIFORM_NAME_1);


	var pad = this.webgl.getPad(N);
	// set the data specific variables in our shader program
	this.bindUniforms(N + pad, a);

	// create our destination texture
	this.webgl.bindOutputTexture(1, N + pad, out);


	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);
	this.webgl.unbindInputTexture(gl.TEXTURE1);

};

/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SAXPYCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SAXPYCalculator.prototype.bindUniforms = function(N, a) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SAXPYCalculator.LENGTH_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SAXPYCalculator.COEFFICIENT_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1f(a_gl, a);

};
