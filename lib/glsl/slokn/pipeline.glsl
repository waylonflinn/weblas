precision highp float;

varying vec2      outTex;  // texture coords of row/column to calculate
uniform sampler2D X;       // texture with data from padded A
uniform float     factor;  // width of image patch
uniform float     stride;  // width between image patches
uniform float     margin;
uniform float     N_p;     // patches across
uniform float     M;
uniform float     N;
uniform float     pad;
uniform float     M_in;
uniform float     N_in;
uniform float     C;       // number of channels in input
uniform float     pad_in;

#pragma glslify: select_index = require(../select_index)
#pragma glslify: linear_index_coords = require(../linear_index_coords)
#pragma glslify: fix_pad = require(../fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate
	float row_t = outTex.y;
	float col_t = outTex.x;

	// row corresponds to patch
	float row = floor(row_t * M) + 0.5;
	// column corresponds to placement in patch
	float col_0 = floor(col_t * (N + pad) - 1.5); // index of first element in output pixel (matrix space)

	// N_p = patches across
	float col_patch = floor(mod(row, N_p)); // column index in grid of patches
	float row_patch = floor(row / N_p); // row index in grid of patches
	float col_in_0 = (col_patch * stride - margin) * C; // input column index of left element in patch
	float row_in_0 = row_patch * stride - margin; // input row index of top element in patch

	vec4 pixel_in;
	vec4 result = vec4(0.0, 0.0, 0.0, 0.0);
	vec2 coords = linear_index_coords(col_0, factor * C); // coords inside patch
	vec2 ncoords;
	int channel_in = int(mod(col_in_0 + coords.x, 4.0));
	vec2 scale_in = vec2(1.0/(N_in + pad_in), 1.0/M_in); // scale from matrix to input texture coords
	vec2 offset_in = vec2(col_in_0 + 2.0 - float(channel_in), row_in_0 + 0.5); // offset into patch (and pixel)

	const vec2 pixel_scale = vec2(1.0/4.0, 1.0); // scale from matrix to pixel coords

	pixel_in = texture2D(X, (coords + offset_in) * scale_in);

	// go through channels for current output pixel
	for(int channel = 0; channel < 4; channel++){

		// are we on a new input pixel?
		ncoords = linear_index_coords(col_0 + float(channel), factor * C);

		// are we in the margin or outside the input texture?
		if((col_in_0 + ncoords.x + 0.5 < 0.0) || (row_in_0 + ncoords.y + 0.5 < 0.0) ||
		   (col_in_0 + ncoords.x + 0.5) > (N_in) || row_in_0 + ncoords.y + 0.5 > M_in){
			// yes, create a virtual pixel
			pixel_in = vec4(0.0, 0.0, 0.0, 0.0);
		} else if(floor(ncoords * pixel_scale) != floor(coords * pixel_scale)){
			// no, get the get the next real pixel
			coords = ncoords;
			offset_in.x += float(channel_in);
			channel_in = 0;
			pixel_in = texture2D(X, (coords + offset_in) * scale_in);
		}


		if(channel == 0){
			result.r = select_index(pixel_in, channel_in);
		} else if(channel == 1){
			result.g = select_index(pixel_in, channel_in);
		} else if(channel == 2){
			result.b = select_index(pixel_in, channel_in);
		} else {
			result.a = select_index(pixel_in, channel_in);
		}

		channel_in++;
		offset_in.x -= 1.0;
	}

	// fix padded region
	if(pad > 0.0 && col_0 + 4.0 > N ) {
		fix_pad(result, int(pad));
	}


	//gl_FragColor = vec4(row_in_0, col_in_0, channel_in, N_p);
	gl_FragColor = result;
}
