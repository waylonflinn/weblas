var WebGL = require('./webgl'),
	glslify = require('glslify');

/* A calculator object for the Float texture based GEMM

	Generalized Matrix Multiply (GEMM):

	C = alpha * A * B + beta * C

	where A * B is matrix multiplication


	webgl - a weblas.WebGL object
	standalone - whether or not to automatically run the floating point encode
		step for rendering to an UNSIGNED_BYTE texture (this is required for
		mobile, circa 2015) but can't be used as part of a pipeline.

	* uploads and downloads data
	* executes calculation
 */
function SGEMMCalculator(webgl, standalone){
	this.webgl = webgl,
	this.standalone = (standalone != null) ? standalone : true; // default to standalone mode

	// read GLSL files
	var s = glslify('./glsl/sgemm/standalone.glsl'),
		s_c = glslify('./glsl/sgemm/standalone_c.glsl'),
		p = glslify('./glsl/sgemm/pipeline.glsl'),
		p_c = glslify('./glsl/sgemm/pipeline_c.glsl');

	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program_ = this.webgl.createProgram(s);
		this.program_c = this.webgl.createProgram(s_c);
	} else {
		this.program_ = this.webgl.createProgram(p);
		this.program_c = this.webgl.createProgram(p_c);
	}

}

module.exports = SGEMMCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SGEMMCalculator.TEXTURE_UNIFORM_NAME_0 = "A";
SGEMMCalculator.TEXTURE_UNIFORM_NAME_1 = "B_t";
SGEMMCalculator.TEXTURE_UNIFORM_NAME_2 = "C";
SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME = "K";
SGEMMCalculator.COLUMN_COUNT_UNIFORM_NAME = "N";
SGEMMCalculator.PAD_UNIFORM_NAME = "pad";
SGEMMCalculator.ALPHA_UNIFORM_NAME = "alpha";
SGEMMCalculator.BETA_UNIFORM_NAME = "beta";

/* Calculate the GEMM, with the given data.

	M - number of rows in A
	N - number of columns in B
	K - number of elements in shared dimension (including padding)
	alpha - scalar for A
	A - left hand matrix (as padded texture)
	B - transpose of right hand matrix (as padded texture)
	beta - scalar for C
	C - additive matrix (texture)
	out - output (texture)

  How this works:

  1. Activate our shader program
  2. Bind input textures
  3. Set shader program parameters
  4. Bind output texture
  5. Activate calculation with `drawElements`

 TODO: signature should look like this:
 ( TRANSA, TRANSB, M, N, K, ALPHA, A, LDA, B, LDB, BETA, C, LDC )
 http://www.math.utah.edu/software/lapack/lapack-blas/dgemm.html
 */
SGEMMCalculator.prototype.calculate = function(M, N, K, alpha, A, B, beta, C, out){

	var gl = this.webgl.context;

	/*
	var h1 = M, w1 = K,
		h2 = K, w2 = N;
	*/

	// set this calculator program as the active program
	if(C != null){
		this.program = this.program_c;
	} else {
		beta = null;
		this.program = this.program_;
		//console.log("no C");
	}
	this.webgl.selectProgram(this.program);

	//  bind our input textures containing matrix data
	this.bindInputTexture(A, gl.TEXTURE0, SGEMMCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(B, gl.TEXTURE1, SGEMMCalculator.TEXTURE_UNIFORM_NAME_1);
	if(C != null){
		this.bindInputTexture(C, gl.TEXTURE2, SGEMMCalculator.TEXTURE_UNIFORM_NAME_2);
	}

	var kPad = this.webgl.getPad(K),
		nPad = this.webgl.getPad(N);

	// set the data specific variables in our shader program
	this.bindUniforms(N, K + kPad, nPad, alpha, beta);

	// create our destination texture
	if(this.standalone){
		this.webgl.bindOutputTexture(M, N + nPad, out);
	} else {
		this.webgl.bindOutputTexture(M, (N + nPad)/ 4, out);
	}

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);
	this.webgl.unbindInputTexture(gl.TEXTURE1);
	this.webgl.unbindInputTexture(gl.TEXTURE2);

	// result can now be read with gl.readResult, or more operations can be
	// performed on destination texture (in pipeline mode)
};


/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SGEMMCalculator.prototype.bindInputTexture = function(texture, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;

	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

};


/* Set up inputs for the texture shader

	K - size of shared dimension for multiplied matrices
 */
SGEMMCalculator.prototype.bindUniforms = function(N, K, pad, alpha, beta) {
	var gl = this.webgl.context;

	// get var locations
	var K_gl	 = gl.getUniformLocation(this.program, SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME),
		alpha_gl = gl.getUniformLocation(this.program, SGEMMCalculator.ALPHA_UNIFORM_NAME),
		beta_gl = gl.getUniformLocation(this.program, SGEMMCalculator.BETA_UNIFORM_NAME),
		N_gl = gl.getUniformLocation(this.program, SGEMMCalculator.COLUMN_COUNT_UNIFORM_NAME),
		pad_gl = pad_gl = gl.getUniformLocation(this.program, SGEMMCalculator.PAD_UNIFORM_NAME);

	gl.uniform1f(beta_gl, beta);
	gl.uniform1i(N_gl, N);
	gl.uniform1i(pad_gl, pad);

	// bind length of shared dimension
	gl.uniform1i(K_gl, K);
	// bind alpha
	gl.uniform1f(alpha_gl, alpha);

};
