var WebGL = require('./webgl'),
	glslify = require('glslify');

/*  a more general version of the BLAS Level 1 scale that works on matrices
    and includes an elementwise scalar addition

    a * X + b

	where X is a matrix, a and b are scalars and operations are elementwise

    to get the standard BLAS scal set M = 1 and b = 0


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SSCALCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	var s = glslify('./glsl/sscal/standalone.glsl'),
		p = glslify('./glsl/sscal/pipeline.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(s);
	} else {
		this.program = this.webgl.createProgram(p);
	}
}

module.exports = SSCALCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SSCALCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SSCALCalculator.LENGTH_UNIFORM_NAME = "N";
SSCALCalculator.ADD_UNIFORM_NAME = "b";
SSCALCalculator.MUL_UNIFORM_NAME = "a";

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
SSCALCalculator.prototype.calculate = function(M, N, a, b, X, out){

	var gl = this.webgl.context;

	var mod = (N % WebGL.COMPONENTS_PER_TEXEL),
		pad = mod == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - mod;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SSCALCalculator.TEXTURE_UNIFORM_NAME_0);

	// set the data specific variables in our shader program
	this.bindUniforms(N, pad, a, b);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + pad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + pad)/ 4, out);
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
SSCALCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};

/* Set up inputs for the texture shader

 */
SSCALCalculator.prototype.bindUniforms = function(N, pad, a, b) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SSCALCalculator.LENGTH_UNIFORM_NAME),
		b_gl = gl.getUniformLocation(this.program, SSCALCalculator.ADD_UNIFORM_NAME),
		a_gl = gl.getUniformLocation(this.program, SSCALCalculator.MUL_UNIFORM_NAME),
		pad_gl = gl.getUniformLocation(this.program, "pad");

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);
	gl.uniform1f(a_gl, a);
	gl.uniform1f(b_gl, b);

};
