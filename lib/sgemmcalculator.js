var WebGL = require('./webgl');

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
	this.standalone = standalone || true; // default to standalone mode


	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(SGEMMCalculator.STANDALONE_FRAGMENT_SHADER);
	} else {
		this.program = this.webgl.createProgram(SGEMMCalculator.PIPELINE_FRAGMENT_SHADER);
	}

}

module.exports = SGEMMCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SGEMMCalculator.TEXTURE_UNIFORM_NAME_0 = "A";
SGEMMCalculator.TEXTURE_UNIFORM_NAME_1 = "B_t";
SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME = "K";
SGEMMCalculator.ALPHA_UNIFORM_NAME = "alpha";

SGEMMCalculator.DOT_FUNCTION = "\n\
 uniform sampler2D A;		// texture with data from padded A           \n\
 uniform sampler2D B_t;		// texture with data from padded transpose of B \n\
 uniform int       K;		// number of elements in shared dimension    \n\
 uniform float alpha; 		// coefficient to multiplication             \n\
 float delta_t = 1./float(K);// space (on texture) between elements     \n\
 \n\
// sum of products between elements in row i (from A) x col j (from B)   \n\
//																		 \n\
// Calculate the dot product between the row (from A) and column (from B)\n\
// identified by the passed indeces (output texture coordinate space).   \n\
// We loop over elements in the row and column and sum the product       \n\
// using the glsl `dot` function to process four elements at a time.     \n\
// This four element optimization requires that the matrix B be          \n\
// transposed before texel packing and that both matrices be padded      \n\
// (with zeros) to a multiple of four (4) in their shared dimension.     \n\
float dot_rowcol(float x, float y) {                                     \n\
	float sum = 0.;			// sum for this row/column pair              \n\
	float z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures \n\
			 															\n\
	for (int l=0 ; l<4096 ; ++l) {                                       \n\
		if(l >= K / 4) break;    // stop when we finish the row/column   \n\
		// l is in pixel space, so we divide by four                     \n\
				 															\n\
		// retrieve next four elements from each texture                 \n\
		vec4 a_ik = texture2D(  A, vec2(z, x));                          \n\
		vec4 b_kj = texture2D(B_t, vec2(z, y));                          \n\
				 															\n\
		// use `dot` to process four elements at a time                  \n\
		sum += alpha * dot(a_ik, b_kj);                                  \n\
		z += (4.0 * delta_t);      // (z + 0.5)*delta                              \n\
	}                                                                    \n\
	return sum;                                                          \n\
}";

/* The GLSL fragment shader that carries out the calculation.

   the `outTex` variable is named and defined in the pass-through vertex shader
 */
SGEMMCalculator.STANDALONE_FRAGMENT_SHADER = "                                  \n\
// fragment shader that calculates the matrix product and renders each   \n\
// element to the bytes representing a 32-bit IEEE754 floating point in  \n\
// the output RGBA canvas.                                               \n\
// readPixel is used to read the bytes.                                  \n\
																		 \n\
precision highp float;                                                   \n\
varying vec2      outTex;	// texture coords of row/column to calculate \n\
	                                                              		\n" +
SGEMMCalculator.DOT_FUNCTION +
WebGL.ENCODE_FLOAT_FUNCTION +
"																		 \n\
																		 \n\
void main(void) {                                                        \n\
																		 \n\
	// get the implied row and column from .y and .x of passed (output)  \n\
	// texture coordinate. These map directly to input texture space when\n\
	// the relevant dimensions are the same.                             \n\
 	float row_t = outTex.y;                                                \n\
	float col_t = outTex.x;                                                \n\
																		 \n\
	// sum row x col for the passed pixel                                \n\
	float sum = dot_rowcol(row_t, col_t);                                    \n\
																		 \n\
	if (sum == 0.) {                                                     \n\
		gl_FragColor = vec4(0.,0.,0.,0.);                                \n\
		return;                                                          \n\
	}                                                                    \n\
																		 \n\
 	// output vec4 with bytes for an IEEE754 32-bit floating point number\n\
	gl_FragColor = encodeFloat(sum);									 \n\
}                                                                        \n\
";


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
	this.webgl.selectProgram(this.program);

	//  bind our input textures containing matrix data
	this.bindInputTexture(A, gl.TEXTURE0, SGEMMCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(B, gl.TEXTURE1, SGEMMCalculator.TEXTURE_UNIFORM_NAME_1);

	// set the data specific variables in our shader program
	this.bindUniforms(K, alpha);

	// bind our destination texture
	this.webgl.bindOutputTexture(M, N, out);

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	this.webgl.unbindInputTexture(gl.TEXTURE0);
	this.webgl.unbindInputTexture(gl.TEXTURE1);

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
SGEMMCalculator.prototype.bindUniforms = function(K, alpha) {
	var gl = this.webgl.context;

	// get var locations
	var K_gl	 = gl.getUniformLocation(this.program, SGEMMCalculator.SHARED_LENGTH_UNIFORM_NAME),
		alpha_gl = gl.getUniformLocation(this.program, SGEMMCalculator.ALPHA_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1i(K_gl, K);
	// bind alpha
	gl.uniform1f(alpha_gl, alpha);

};
