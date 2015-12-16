

/* A calculator object for the Float texture based GEMM

	gl - WebGL object

	* uploads and downloads data
	* executes calculation
 */
function GEMMFloatCalculator(webgl){
	this.webgl = webgl;


	// create the webgl shader program for this calculation
	// based on the specific fragment shader for this calculation
	// and the generic pass through shader
	this.program = this.webgl.createProgram(GEMMFloatCalculator.FRAGMENT_SHADER);

}

module.exports = GEMMFloatCalculator;

GEMMFloatCalculator.FRAGMENT_SHADER = "                                  \n\
// fragment shader that calculates the sum of the passed row and         \n\
// column (texture coord).                                               \n\
// we loop over the row and column and sum the product.                  \n\
// product is then rendered to 32-bit IEEE754 floating point in the      \n\
// output RGBA canvas.                                                   \n\
// readPixel is used to read the bytes.                                  \n\
																		 \n\
#ifdef GL_ES                                                             \n\
precision highp float;                                                   \n\
#endif                                                                   \n\
																		 \n\
varying vec2	  outTex;     // row, column to calculate                \n\
uniform sampler2D usampler;	  // left in .r, right in .g                 \n\
uniform int		  K;          // interior (matching) dimension (r1/c2)   \n\
uniform float	  delCol;     // space between columns on source texture \n\
uniform float	  delRow;     // space between rows on source texture    \n\
																		 \n\
// sum row i x col j                                                     \n\
float sumrowcol(float i, float j) {                                      \n\
	float sum = 0.;                // sum                                \n\
	float k_c = 0.5 * delCol;      // column position on source texture  \n\
	float k_r = 0.5 * delRow;      // row position on source texture     \n\
	for (int k=0 ; k<4096 ; ++k) {                                       \n\
		if(k >= K) break;         // stop when we finish the row/column  \n\
		float a_ik = texture2D(usampler,vec2( k_c,   i)).r;              \n\
		float b_kj = texture2D(usampler,vec2(   j, k_r)).g;              \n\
		sum += (a_ik*b_kj);                                              \n\
		k_c += delCol;      // (k + 0.5)*delCol                          \n\
		k_r += delRow;	    // (k + 0.5)*delRow                          \n\
	}                                                                    \n\
	return sum;                                                          \n\
}                                                                        \n\
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
	 // get the implied row and column from .y and .x                    \n\
	 // of passed (output) texel                                         \n\
 	float row = outTex.y;                                                \n\
	float col = outTex.x;                                                \n\
																		 \n\
	// sum row x col for the passed pixel                                \n\
	float sum = sumrowcol(row,col);                                      \n\
																		 \n\
	if (sum == 0.) {                                                     \n\
		gl_FragColor = vec4(0.,0.,0.,0.);                                \n\
		return;                                                          \n\
	}                                                                    \n\
																		 \n\
 	// output an IEEE754 32-bit floating point number 				  	 \n\
	gl_FragColor = encodeFloat(sum);									 \n\
}                                                                        \n\
";

/* Pack the given matrix data into texel layout for use by texture shader.
   This layout places each matrix in a different plane of the texture,
   one in 'r' the second in 'g'
 */
GEMMFloatCalculator.packData = function(d1, h1, w1, d2, h2, w2) {

	// dimensions
	var BYTES_PER_TEXEL = 3; // RGB: one byte per channel, three bytes per texel
	var r1 = h1, c1 = w1, r2 = h2, c2 = w2;
	var r = Math.max(r1,r2);
	var c = Math.max(c1,c2);
	var texelcount = r*c;
	// get texel data (rgb) as a Float32Array
	var texels = new Float32Array(texelcount*BYTES_PER_TEXEL);

	var dst = 0, src1=0, src2=0;
	// special case if same dimensions
	if (r1===r2 && c1===c2) {
		// copy m1 to .r and m2 to .g
		do {
			texels[dst++] = d1[src1++]; // red
			texels[dst++] = d2[src2++]; // green
			dst++;						// blue
		} while(--texelcount);
	} else {

		var row=0, col=0, texel = 0;
		do {
			texel = dst / BYTES_PER_TEXEL | 0;
			col = texel % c;
			row = texel / c | 0;
			if(col < c1 && row < r1)
				texels[dst] = d1[src1++];

			dst++;						// red -> green

			if(col < c2 && row < r2)
				texels[dst] = d2[src2++];

			dst += 2;						// green -> red (skip blue)

		} while(--texelcount);

	}
	return texels;
};

GEMMFloatCalculator.TEXTURE_UNIFORM_NAME = "usampler";

/* Create a texture from the given texel data and bind it to our shader program.
  must set up shader first
*/
GEMMFloatCalculator.prototype.bindInputTexture = function(h, w, texels){
	var gl = this.webgl.context,
		program = this.program;


	// set canvas and viewport size
	this.webgl.canvas.height = h;
	this.webgl.canvas.width = w;
	gl.viewport(0, 0, w, h);

	// create the texture from our floats
	var texture = gl.createTexture();
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(	  gl.TEXTURE_2D, texture);
	gl.texImage2D(	  gl.TEXTURE_2D, /*level*/0, gl.RGB, w, h, 0,
					  gl.RGB, gl.FLOAT, texels);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	var sampler = gl.getUniformLocation(program, GEMMFloatCalculator.TEXTURE_UNIFORM_NAME);
	gl.uniform1i(sampler, 0); // (textureUnit - gl.TEXTURE0)

	return texture;
};

GEMMFloatCalculator.prototype.bindDestinationTexture = function(h1, w2, dstTex) {
	var gl = this.webgl.context;

	// create and bind renderbuffer
	this.renderbuffer = this.renderbuffer || gl.createRenderbuffer();

	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderbuffer);

	gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16, w2, h1);

	// create and bind framebuffer
	this.framebuffer = this.framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,dstTex,/*level*/0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.renderbuffer);

	return this.framebuffer;
};

/* Calculate the GEMM, with the given data.

  Steps are:

  1. Activate our shader program
  2. Create a texture to hold the input data
  3. Set shader program parameters (based on matrix sizes)
  4. Create a texture to hold the output
  5. Activate calculation with `drawElements`
  6. Read result with `readPixels` and return it

 TODO: signature should look like this:
 ( TRANSA, TRANSB, M, N, K, ALPHA, A, LDA, B, LDB, BETA, C, LDC )
 http://www.math.utah.edu/software/lapack/lapack-blas/dgemm.html
 */
GEMMFloatCalculator.prototype.calculate = function(M, N, K, alpha, A, B, beta, C){

	var gl = this.webgl.context,
		destTexture,
		frameBuffer,
		rawbuffer;

	var h1 = M,
		w1 = K,
		h2 = K,
		w2 = N;

	var h = Math.max(h1, h2),
		w = Math.max(w1, w2);

	//console.log(h1 + "x" + w1 + " times " + h2 + "x" + w2);
	// set calculator program to current shader program
	gl.useProgram(this.program);


	// pack the data into a single RGB texel array
	var texels = GEMMFloatCalculator.packData(A, h1, w1, B, h2, w2);

	// create and bind our input texture using matrix data
	this.bindInputTexture(h, w, texels);


	// set the data specific variables in our shader program
	this.bindUniforms(h, w, K);
	this.bindVertices();

	// create our destination texture
	destTexture = this.webgl.createDestinationTexture(M, N);
	frameBuffer = this.bindDestinationTexture(M, N, destTexture);


	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
		throw new Error("Bound framebuffer is not complete.");

	// initiate calculation
	gl.drawElements(gl.TRIANGLES, /*num items*/6, gl.UNSIGNED_SHORT, 0);

	// create destination buffer
	rawbuffer = new ArrayBuffer(M*N*Float32Array.BYTES_PER_ELEMENT);

	// read the result into our buffer, as bytes
	prod = new Uint8Array(rawbuffer);
	gl.readPixels(0, 0, N, M, gl.RGBA, gl.UNSIGNED_BYTE, prod);

	// create and return a view over result bytes as a float array
	return new Float32Array(rawbuffer); // M x N
};

	// set up vars for the shaders
GEMMFloatCalculator.prototype.bindUniforms = function(h, w, K) {
	var gl = this.webgl.context;

	// get var locations
	var length	= gl.getUniformLocation(this.program, "K");
	var delCol	= gl.getUniformLocation(this.program, "delCol");
	var delRow	= gl.getUniformLocation(this.program, "delRow");

	// bind length of shared dimension
	gl.uniform1i(length, K);

	// bind step size for input texture
	// 3x10 x 10x2 -> 3x2 output, but requires 10x10 *input* texture
	gl.uniform1f(delCol, 1./w);
	gl.uniform1f(delRow, 1./h);
};

/* setup required to draw a square to our vertex shader and have
   fragment shader called for each pixel
 */
GEMMFloatCalculator.prototype.bindVertices = function() {
	var gl = this.webgl.context,
		renderer = this.program;

	// bind vertices
	var aPos = gl.getAttribLocation(renderer,"aPos");
	var vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

	// define a square that covers the screen
	var vertices = [-1.0, -1.0, 0.0,	// bottom left
					 1.0, -1.0, 0.0,	// bottom right
					 1.0,  1.0, 0.0,	// top right
					-1.0,  1.0, 0.0];	// top left
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(aPos, /*item size*/3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(aPos);

	// bind texture cords
	var aTex = gl.getAttribLocation(renderer,"aTex");
	var texCoords = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
	var textureCoords = [0.0, 0.0,
						 1.0, 0.0,
						 1.0, 1.0,
						 0.0, 1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
	gl.vertexAttribPointer(aTex, /*item size*/2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(aTex);

	// index to vertices
	var indices = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
	// tesselate square into triangles
	// indeces into vertex array creating triangles, with counter-clockwise winding
	var vertexIndices = [0, 1, 2,	// bottom right triangle
						 0, 2, 3];	// top left triangle
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
};
