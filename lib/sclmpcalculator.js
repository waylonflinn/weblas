var WebGL = require('./webgl');

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
	this.standalone = standalone || true; // default to standalone mode


	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(SCLMPCalculator.STANDALONE_FRAGMENT_SHADER);
	} else {
		this.program = this.webgl.createProgram(SCLMPCalculator.PIPELINE_FRAGMENT_SHADER);
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

/* The GLSL fragment shader that carries out the calculation.

   the `outTex` variable is named and defined in the pass-through vertex shader
 */
SCLMPCalculator.STANDALONE_FRAGMENT_SHADER = "                           \n\
precision highp float;                                                   \n\
																		 \n\
varying vec2      outTex;	// texture coords of row/column to calculate \n\
uniform sampler2D X;		// texture with data from padded A           \n\
uniform int N; \n\
uniform int pad; \n\
uniform float a; 		// lower bound             \n\
uniform float b; 		// upper bound                        \n\
																		  \n" +
WebGL.ENCODE_FLOAT_FUNCTION +
WebGL.SELECT_CHANNEL_FUNCTION +
"																		 \n\                                                                      \n\
																		 \n\
void main(void) {                                                        \n\
																		 \n\
	// get the implied row and column from .y and .x of passed (output)  \n\
	// texture coordinate. These map directly to input texture space when\n\
	// the relevant dimensions are the same.                             \n\
	 float row = outTex.y;                                                \n\
	float col = outTex.x;                                                \n\
	\n\
	// return 0.0 if in padded region of output texture \n\
	if(col * float(N + pad) > float(N) ) {                               \n\
		gl_FragColor = vec4(0.,0.,0.,0.);                                \n\
		return;                                                          \n\
	}      \n\
	\n\
	// direct usage of col requires output be padded exactly like input	 \n\
	vec4 x = texture2D( X, vec2(col, row));                  \n\
	vec4 val = clamp(x, a, b);\n\
	// select and output channel (standalone version only)\n\
	int channel = int(mod(col * float(N + pad), 4.0 )); \n\
	float sum = selectIndex(val, channel); \n\
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

	var mod = (N % WebGL.COMPONENTS_PER_TEXEL),
		pad = mod == 0 ? 0 : WebGL.COMPONENTS_PER_TEXEL - mod;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, SCLMPCalculator.TEXTURE_UNIFORM_NAME_0);


	// set the data specific variables in our shader program
	this.bindUniforms(N, pad, a, b);

	// create our destination texture
	this.webgl.bindOutputTexture(M, N + pad, out);


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
