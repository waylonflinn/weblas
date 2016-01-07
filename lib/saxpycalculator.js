

/* A calculator object for the Float texture based GEMM

	Generalized Matrix Multiply (GEMM):

	C = alpha * A * B + beta * C

	where A * B is matrix multiplication


	webgl - a weblas.WebGL object

	* uploads and downloads data
	* executes calculation
 */
function SAXPYCalculator(webgl){
	this.webgl = webgl;


	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	this.program = this.webgl.createProgram(SAXPYCalculator.FRAGMENT_SHADER);

}

module.exports = SAXPYCalculator;

/* Names of the uniforms (variables) used in the shader program passed in on
   each calculation.
 */
SAXPYCalculator.TEXTURE_UNIFORM_NAME_0 = "X";
SAXPYCalculator.TEXTURE_UNIFORM_NAME_1 = "Y";
SAXPYCalculator.LENGTH_UNIFORM_NAME = "N";
SAXPYCalculator.COEFFICIENT_UNIFORM_NAME = "a";

/* The GLSL fragment shader that carries out the calculation.

   the `outTex` variable is named and defined in the pass-through vertex shader
 */
SAXPYCalculator.FRAGMENT_SHADER = "                                  \n\
// fragment shader that calculates the matrix product and renders each   \n\
// element to the bytes representing a 32-bit IEEE754 floating point in  \n\
// the output RGBA canvas.                                               \n\
// readPixel is used to read the bytes.                                  \n\
																		 \n\
precision highp float;                                                   \n\
																		 \n\
varying vec2      outTex;	// texture coords of row/column to calculate \n\
uniform sampler2D X;		// texture with data from padded A           \n\
uniform sampler2D Y;		// texture with data from padded transpose of B \n\
uniform int N; \n\
uniform float a; 		// coefficient to multiplication             \n\
                                                                     \n\
																		 \n\
// Render float to bytes according to IEEE 754 Floating Point            \n\
vec4 encodeFloat(float val) {                                            \n\
																		 \n\
	// TODO: correctly handle denormal numbers                           \n\
	// http://www.2ality.com/2012/04/number-encoding.html                \n\
	float a = abs(val);                           // encode absolute value + sign \n\
	float exp = floor(log2(a));                 // number of powers of 2 \n\
	float mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1) \n\
	float mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa \n\
	float mant2 = mod(floor(mant / 256.),256.); // second 8 bits         \n\
	float mant3 = mod(mant,256.);               // third 8 bits          \n\
																		 \n\
	highp float sign = 128.-128.*(a/val);			// sign bit is 256 or 0  \n\
	highp float e = (sign+exp+127.)/510.;		// exponent and sign     \n\
	highp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit \n\
	highp float m2 = (mant2)/255.;				// middle part           \n\
	highp float m3 = (mant3+.5)/255.;			// scale to 0 - 255      \n\
																		 \n\
	return vec4(m3,m2,m1,e);                                             \n\
}                                                                        \n\
																		 \n\
void main(void) {                                                        \n\
																		 \n\
	// get the implied row and column from .y and .x of passed (output)  \n\
	// texture coordinate. These map directly to input texture space when\n\
	// the relevant dimensions are the same.                             \n\
 	float row = outTex.y;                                                \n\
	float col = outTex.x;                                                \n\
																		 \n\
	// direct usage of col requires output be padded exactly like input	 \n\
	vec4 x = texture2D( X, vec2(col, row));                                  \n\
	vec4 y = texture2D( Y, vec2(col, row));                                  \n\
	vec4 sum_v = (a * x) + y;                                    \n\
	float sum; \n\
	int type = int(mod(col * float(N), 4.0 )); \n\
	if (type == 0) {\n\
		sum = sum_v.r;\n\
	} else {\n\
		if(type == 1) {\n\
			sum = sum_v.g;\n\
		} else { \n\
			if(type == 2) {\n\
				sum = sum_v.b;\n\
			} else {\n\
				if(type == 3){ \n\
					sum = sum_v.a;\n\
				} else { \n\
					// should never be here \n\
					sum = 0.0/0.0;  // should produce NaN\n\
				}\n\
			} \n\
		}\n\
	}\n\
	//sum = float(type);\n\
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
	K - number of elements in shared dimension
	alpha - scalar for A
	A - left hand matrix
	B - right hand matrix
	beta - scalar for C
	C - additive matrix

  How this works:

  1. Activate our shader program
  2. Create a texture to hold the input data
  3. Set shader program parameters (based on matrix sizes)
  4. Create a texture to hold the output
  5. Activate calculation with `drawElements`
  6. Read result with `readPixels` and return it

 */
SAXPYCalculator.prototype.calculate = function(N, a, X, Y){

	var gl = this.webgl.context,
		destTexture,
		frameBuffer,
		rawbuffer;

	/*
	var h1 = M, w1 = K,
		h2 = K, w2 = N;
	*/


	this.webgl.selectProgram(this.program);

	// pack each matrix into a single RGBA texel array, with the second transposed
	var texels0 = SAXPYCalculator.packData(N, X, false);
		texels1 = SAXPYCalculator.packData(N, Y, false);

	// console.log(texels0);
	// console.log(texels1);
	var mod = (N % 4),
		pad = mod == 0 ? 0 : 4 - mod;

	// create and bind our input texture using matrix data
	this.bindInputTexture(1, N + pad, texels0, gl.TEXTURE0, SAXPYCalculator.TEXTURE_UNIFORM_NAME_0);
	this.bindInputTexture(1, N + pad, texels1, gl.TEXTURE1, SAXPYCalculator.TEXTURE_UNIFORM_NAME_1);


	// set the data specific variables in our shader program
	this.bindUniforms(N + pad, a);

	// create our destination texture
	destTexture = this.webgl.createDestinationTexture(1, (N + pad));
	frameBuffer = this.webgl.bindDestinationTexture(1, (N + pad), destTexture);


	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
		throw new Error("Bound framebuffer is not complete.");

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	// create destination buffer
	rawbuffer = new ArrayBuffer((N + pad)*Float32Array.BYTES_PER_ELEMENT);

	// read the result into our buffer, as bytes
	prod = new Uint8Array(rawbuffer);
	gl.readPixels(0, 0, N + pad, 1, gl.RGBA, gl.UNSIGNED_BYTE, prod);

	// create and return a view over result bytes as a float array
	return new Float32Array(rawbuffer.slice(0, N * 4)); // N
};

/* Pack the given matrix data into texel layout for use by texture shader.

   This layout places consecutive elements of the input data into separate
   channels, padding to a multiple of four (with zeros) where necessary to fill
   out the final RGBA texel in a column.

   r - row count
   c - column count
   data - TypedArray containing matrix data
   transpose - whether or not to transpose the data when packing
 */
SAXPYCalculator.packData = function(n, data) {

	var CHANNELS_PER_TEXEL = 4; // RGBA: four channels, one per color

	var mod = (n % CHANNELS_PER_TEXEL),
		pad = mod == 0 ? 0 : CHANNELS_PER_TEXEL - mod;



	var texelcount = n+pad,
		i = 0;

	// create Float32Array to hold padded texel data
	var texels = new Float32Array(texelcount);

	// check if the input is an array or a number
	if(isNumeric(data)){
		// if it's a number, fill array with constant value
		for(i = 0; i < n; i++){
			texels[i] = data;
		}
	} else {
		// copy actual data
		for(i = 0; i < n; i++){
			texels[i] = data[i];
		}
	}


	// pad last texel in this row with zeros
	for(p = 0; p < pad; p++){
		texels[i + p] = 0.0;
	}

	return texels;
};

// is a number, not an array
function isNumeric( obj ) { return (obj - parseFloat( obj ) + 1) >= 0; }

/* Create a texture from the given texel data and bind it to our shader program.

	h - number of rows in input matrix
	w - number of cols in input matrix
	texels - packed data
	textureUnit - the texture unit to bind to (gl.TEXTURE0, gl.TEXTURE1, etc)
	name - the uniform name to associate with (must match shader program)

	must compile program (with createProgram) first
*/
SAXPYCalculator.prototype.bindInputTexture = function(h, w, texels, textureUnit, name){
	var gl = this.webgl.context,
		program = this.program;



	// create the texture from our floats
	var texture = gl.createTexture();
	gl.activeTexture(textureUnit); // gl.TEXTURE0, gl.TEXTURE1, etc
	gl.bindTexture(	  gl.TEXTURE_2D, texture);
	gl.texImage2D(	  gl.TEXTURE_2D, /*level*/0, gl.RGBA, w / 4, h, 0,
					  gl.RGBA, gl.FLOAT, texels);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	var sampler = gl.getUniformLocation(program, name);
	gl.uniform1i(sampler, textureUnit - gl.TEXTURE0);

	return texture;
};

/* Set up inputs for the texture shader

 */
SAXPYCalculator.prototype.bindUniforms = function(N, a) {
	var gl = this.webgl.context;

	// get var locations
	var N_gl = gl.getUniformLocation(this.program, SAXPYCalculator.LENGTH_UNIFORM_NAME);
		a_gl = gl.getUniformLocation(this.program, SAXPYCalculator.COEFFICIENT_UNIFORM_NAME);

	// bind length of shared dimension
	gl.uniform1i(N_gl, N);
	gl.uniform1f(a_gl, a);

};
