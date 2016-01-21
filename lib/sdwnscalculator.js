var WebGL = require('./webgl');

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
	this.standalone = standalone || true; // default to standalone mode


	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	if(this.standalone){
		this.program = this.webgl.createProgram(DownsampleCalculator.STANDALONE_FRAGMENT_SHADER);
	} else {
		this.program = this.webgl.createProgram(DownsampleCalculator.PIPELINE_FRAGMENT_SHADER);
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
DownsampleCalculator.CHANNEL_COUNT_UNIFORM_NAME = "c";

/* The GLSL fragment shader that carries out the calculation.

   the `outTex` variable is named and defined in the pass-through vertex shader
 */
 // TODO: unroll loop for stride == factor and small values (2, 3)
DownsampleCalculator.STANDALONE_FRAGMENT_SHADER = "                      \n\
precision highp float;                                                   \n\
																		 \n\
varying vec2      outTex;	// texture coords of row/column to calculate \n\
uniform sampler2D X;		// texture with data from padded A           \n\
uniform int factor; // width of image patch\n\
uniform float stride; // width between image patches\n\
uniform float c; 		// number of channels \n\
uniform float M;\n\
uniform float N;\n\
uniform float N_out;\n\
uniform float M_out;\n\
	                                                              		\n" +
WebGL.ENCODE_FLOAT_FUNCTION +
WebGL.SELECT_INDEX_FUNCTION +
"																		 \n\                                                                      \n\
																		 \n\
void main(void) {                                                        \n\
																		 \n\
	// get the implied row and column from .y and .x of passed (output)  \n\
	// texture coordinate and translate to input texture space.          \n\
	float row_p = floor(outTex.y * M_out);   // row on output texture (pixel space)   \n\
	float col_p = floor(outTex.x * N_out/4.0); // column on output texture (pixel space)\n\
	float vcol_p = floor(col_p / c);   // virtual column on output texture (pixel space)\n\
	float vchannel_p = mod(col_p, c); // virtual channel on output texture\n\
	\n\
																			\n\
	const float min = -1.0e+08;\n\
	vec4 currentMax = vec4(min, min, min, min); \n\
	\n\
	float deltaY = 1.0/M;\n\
	float deltaX = 4.0/N;\n\
	float y = ((row_p * stride) + 0.5)*deltaY; // position of input row				\n\
	float x; \n\
	float z = vchannel_p * deltaX;\n\
	for (int i = 0; i < 100; i += 1) {										\n\
		if (i >= factor) {													\n\
			break;															\n\
		}																	\n\
		x = ((vcol_p * stride * c) + 0.5) * deltaX; // position of input column	\n\
																			\n\
		for (int j = 0; j < 100; j += 1) {									\n\
			if (j >= factor) {												\n\
				break;														\n\
			}																\n\
																			\n\
			vec2 coords = vec2(x + z, y); \n\
	        vec4 x_v = texture2D(X, coords);				\n\
	        currentMax = max(currentMax, x_v);								\n\
																			\n\
			x += (deltaX * c);											\n\
		}																	\n\
		y += deltaY;															\n\
	}																		\n\
	int chan = int(mod(outTex.x * N_out, 4.0 )); \n\
	float val = selectIndex(currentMax, int(chan)); \n\
	if (val == 0.) {                                                 \n\
		gl_FragColor = vec4(0.,0.,0.,0.);                                \n\
		return;                                                          \n\
	}                                                                   \n\
	\n\
	gl_FragColor = encodeFloat(val);\n\
}";


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
DownsampleCalculator.prototype.calculate = function(M, N, c, factor, stride, X, out){

	var gl = this.webgl.context;


    var N_out = (Math.floor((N - factor) / stride) + 1) * c * WebGL.COMPONENTS_PER_TEXEL;
    var M_out = Math.floor((M - factor) / stride) + 1;

	this.webgl.selectProgram(this.program);

	// create and bind our input texture using matrix data
	this.bindInputTexture(X, gl.TEXTURE0, DownsampleCalculator.TEXTURE_UNIFORM_NAME_0);


	// set the data specific variables in our shader program
	this.bindUniforms(M, N * c * WebGL.COMPONENTS_PER_TEXEL, M_out, N_out, factor, stride, c);

	// create our destination texture
	this.webgl.bindOutputTexture(M_out, N_out, out);


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
