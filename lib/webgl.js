/*
Copyright (c) 2015 Waylon Flinn

webgl.js

multiply matrices up to 4096 x 4096 on GPUs that support OES_texture_float
extension. input is encoded into the red and green channels of an input texture and
calculations are done using a custom fragment shader.

*/


/*
	A WebGL context associated with a specific canvas element.

	* creates a canvas
	* sets up webgl context
	* translates numbers into textures
	* compiles shader programs for executing math (when supplied with an
		operation specific fragment shader)
 */
function WebGL(options) {

	var glOptions,
		ext;

	options = options || {};

	// canvas
	if(typeof options.canvas === 'undefined')
		this.canvas = document.createElement('canvas');
	else
		this.canvas = options.canvas;

	// context
	glOptions = { premultipliedAlpha: false, preserveDrawingBuffer: false };
	this.context = this.canvas.getContext("experimental-webgl", glOptions);

	if (typeof this.context === 'undefined')
		throw new Error("No support for Webgl.");

	// float texture extension
	try {
		ext = this.context.getExtension('OES_texture_float');
	} catch(e) {

	}
	if ( !ext ) {
		console.log("No support for OES_texture_float extension.");
		this.hasFloat = false;
	} else {
		this.hasFloat = true;
	}

	var highp = this.context.getShaderPrecisionFormat(this.context.FRAGMENT_SHADER, this.context.HIGH_FLOAT);
	this.hasHighPrecision = highp.precision != 0;
	if(this.hasHighPrecision) this.highp = highp;

	// create pass through vertex shader
	this.vertexShader = this.context.createShader(this.context.VERTEX_SHADER);
	this.context.shaderSource(this.vertexShader, WebGL.PASS_THROUGH_VERTEX_SHADER);
	this.context.compileShader(this.vertexShader);

};

module.exports = WebGL;

// RGBA is the standard input/ouput texture
WebGL.COMPONENTS_PER_TEXEL = 4;

WebGL.POSITION_UNIFORM_NAME = "pos";
WebGL.TEXTURE_UNIFORM_NAME = "tex";

WebGL.PASS_THROUGH_VERTEX_SHADER = "\
// vertex shader for a single quad                                           \n\
// work is performed in the operation specific texture shader                \n\
		                                                                     \n\
precision highp float;                                                       \n\
		                                                                     \n\
attribute vec3 pos;                                                         \n\
attribute vec2 tex;                                                         \n\
varying vec2   outTex;                                                         \n\
void main(void)                                                              \n\
{                                                                            \n\
	// just pass the position and texture coords                             \n\
	gl_Position = vec4(pos, 1.0);                                           \n\
	outTex = tex;                                                             \n\
}                                                                            \n\
";

WebGL.ENCODE_FUNCTION = "\n\
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
}";

/*
	use a loop for this instead?
	vectors can be indexed with loop indeces
	http://stackoverflow.com/questions/19529690/index-expression-must-be-constant-webgl-glsl-error
 */
WebGL.SELECT_CHANNEL_FUNCTION = "									\n\
float selectIndex(vec4 v, int index){								\n\
	float val;														\n\
	if (index == 0) {												\n\
		val = v.r;													\n\
	} else if(index == 1) {											\n\
		val = v.g;													\n\
	} else if(index == 2) {											\n\
		val = v.b;													\n\
	} else if(index == 3){											\n\
		val = v.a;													\n\
	} else {														\n\
		// should never be here										\n\
		val = 0.0;													\n\
	}																\n\
	return val;														\n\
}";

/*  Create a shader program based on a pass through vertex shader and
	the supplied operation specific fragment shader.

	fragmentShaderSource - string containing the fragment shader source code.
	shader will recieve `vec2 outTex` with texture coordinates from the pass
	through vertex shader.
 */
WebGL.prototype.createProgram = function(fragmentShaderSource){
	var gl = this.context,
		fragmentShader;

	// compile the provided fragment/texture shader
	fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(fragmentShader, fragmentShaderSource);
	gl.compileShader(fragmentShader);

	// did it compile correctly?
	if (gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS) == 0)
		throw new Error(gl.getShaderInfoLog(fragmentShader));

	// link the program specific fragment shader and the generic pass through
	// shader into a program
	var program = gl.createProgram();
	gl.attachShader(program, this.vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	return program;
};

WebGL.prototype.selectProgram = function(program){

	var gl = this.context;

	// set calculator program to current shader program
	gl.useProgram(program);

	this.bindVertices(program);
};

/* setup required to draw a square to our vertex shader and have
   fragment shader called for each pixel
 */
WebGL.prototype.bindVertices = function(program) {
	var gl = this.context,
		renderer = program;

	// bind vertices
	var position = gl.getAttribLocation(renderer, WebGL.POSITION_UNIFORM_NAME);
	var vertexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

	// define a square that covers the screen
	var vertices = [-1.0, -1.0, 0.0,	// bottom left
					 1.0, -1.0, 0.0,	// bottom right
					 1.0,  1.0, 0.0,	// top right
					-1.0,  1.0, 0.0];	// top left
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.vertexAttribPointer(position, /*item size*/3, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(position);

	// bind texture cords
	var texture = gl.getAttribLocation(renderer, WebGL.TEXTURE_UNIFORM_NAME);
	var texCoords = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, texCoords);
	var textureCoords = [0.0, 0.0,
						 1.0, 0.0,
						 1.0, 1.0,
						 0.0, 1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
	gl.vertexAttribPointer(texture, /*item size*/2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(texture);

	// index to vertices
	var indices = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
	// tesselate square into triangles
	// indeces into vertex array creating triangles, with counter-clockwise winding
	var vertexIndices = [0, 1, 2,	// bottom right triangle
						 0, 2, 3];	// top left triangle
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
};

/* create RGBA texture of width w/4 from given texels
   padding the width of each row to a multiple of 4, where necessary.

   if texels is null, an empty texture is created.

   alternative to textures?
   http://stackoverflow.com/questions/17203508/webgl-hardware-skinning-with-a-bone-texture
 */
WebGL.prototype.createDataTexture = function(h, w, texels){

	var gl = this.context;

	var COMPONENTS_PER_TEXEL = 4,
		PAD_VALUE = 0.0; // value to pad remainder with

	var rem = (w % COMPONENTS_PER_TEXEL),
		pad = rem == 0 ? 0 : COMPONENTS_PER_TEXEL - rem;

	// create the texture from our floats
	var texture = gl.createTexture();

	gl.bindTexture(	  gl.TEXTURE_2D, texture);
	/*
	// https://www.opengl.org/wiki/GLAPI/glPixelStore
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, w/4);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

	see also: https://www.opengl.org/wiki/Common_Mistakes#Creating_a_complete_texture
	*/
	if(pad == 0 || texels == null || typeof texels === 'undefined'){
		// no padding required, write directly from input array
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, w / COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, texels);

	} else {
		// must pad each row

		// create empty texture
		gl.texImage2D(	  gl.TEXTURE_2D, 0, gl.RGBA, (w + pad) / COMPONENTS_PER_TEXEL, h, 0,
						  gl.RGBA, gl.FLOAT, null);

		var full_texel_row_len = w - rem,
			full_row_texture_width = full_texel_row_len / COMPONENTS_PER_TEXEL;

		var row_start = 0;
		var last_texel = new Float32Array(COMPONENTS_PER_TEXEL);
		var row, remainder;

		// set texture data, one row at a time, padding each row to a multiple
		// of the texel length
		for(var i = 0; i < h; i++){
			row_start = i * w;
			full_texel_row_end = row_start + full_texel_row_len;
			row = new Float32Array(texels.buffer, row_start * texels.BYTES_PER_ELEMENT, full_texel_row_len);
			if(full_texel_row_len > 0){
				// https://www.khronos.org/registry/webgl/specs/latest/1.0/index.html#TEXSUBIMAGE2D
				gl.texSubImage2D(gl.TEXTURE_2D,
					 0,					// mip-map level
					 0,					// x-offset
					 i,					// y-offset
					 full_row_texture_width,	// width
					 1,					// height
					 gl.RGBA,			// format
					 gl.FLOAT,			// type
					 row			// data
				 );
			}

			// pad the last pixel to 4 components, using PAD_VALUE for extra
			last_texel.fill(PAD_VALUE);
			remainder = new Float32Array(texels.buffer, full_texel_row_end * texels.BYTES_PER_ELEMENT, rem);
			last_texel.set(remainder); // copy remaining data

			gl.texSubImage2D(gl.TEXTURE_2D,
				 0,				// mip-map level
				 full_row_texture_width, // x-offset
				 i,				// y-offset
				 1,				// width
				 1,				// height
				 gl.RGBA,		// format
				 gl.FLOAT,		// type
				 last_texel		// data
			 );
		}
	}

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return texture;
};

/* Create a texture suitable for reading into an array with readPixels.
	UNSIGNED_BYTE
   Can be passed to bindDestinationTexture.

   Returns an unsigned byte RGBA texture (other formats are not yet supported
	on most platforms, see WEBGL_color_buffer_float extension)
 */
WebGL.prototype.createOutputTexture = function(h, w) {
	var gl = this.context;

	// create and bind texture to render to
	var destTexture = gl.createTexture();
	//gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D, destTexture);
	gl.texImage2D(gl.TEXTURE_2D,/*level*/0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// clamp to edge to support non-power of two textures
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	// we're done with setup, so unbind current texture
	gl.bindTexture(gl.TEXTURE_2D, null);

	return destTexture;
};

/* Set up output

	M - number of rows in output
	N - number of columns in output
	dstTex - texture for holding the output
 */
WebGL.prototype.bindOutputTexture = function(M, N, texture) {
	var gl = this.context;

	// set canvas and viewport size
	this.canvas.height = M;
	this.canvas.width = N;
	gl.viewport(0, 0, N, M);

	// create and bind framebuffer
	this.framebuffer = this.framebuffer || gl.createFramebuffer();

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);

	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, /*level*/0);


	if( gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE)
		throw new Error("Bound framebuffer is not complete.");

	return this.framebuffer;
};

WebGL.prototype.unbindInputTexture = function(textureUnit){
	var gl = this.context;

	gl.activeTexture(textureUnit);
	gl.bindTexture(gl.TEXTURE_2D, null);
};

/* Read data out as unsigned bytes */
WebGL.prototype.readData = function(M, N){
	var gl = this.context;

	// create destination buffer
	rawbuffer = new ArrayBuffer(M*N*Float32Array.BYTES_PER_ELEMENT);

	// read the result into our buffer, as bytes
	prod = new Uint8Array(rawbuffer);
	gl.readPixels(0, 0, N, M, gl.RGBA, gl.UNSIGNED_BYTE, prod);

	// return raw result bytes
	return rawbuffer; // M x N
}
