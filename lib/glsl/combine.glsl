precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A
uniform sampler2D B;		// texture with data from padded B
uniform float     N_in;		// number of columns
uniform float     pad_in;	// additional columns to nearest multiple of four

#pragma glslify: fix_pad = require(./fix_pad)

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = outTex.y;
	float col_t = outTex.x;
	float N = N_in * 2.0;
	float pad = mod(N, 4.0);
	float col = (col_t * (N + pad) - 2.0); // index of first element in pixel (output matrix space)

	vec4 x;
	// which input texture are we getting this pixel from?
	if(col + 4.0 < N_in){
		x = texture2D( A, vec2((col + 2.0) / (N_in + pad_in) , row_t));
	} else {
		vec4 x0, x1;
		x1 = texture2D( B, vec2((col + 6.0 - (N_in + pad_in)) / (N_in + pad_in) , row_t));
		if(col + 0.5 < N_in){
			x0 = texture2D( A, vec2((col + 2.0) / (N_in + pad_in) , row_t));
			if(pad_in == 0.0){
				x = x0;
			} else if(pad_in == 1.0){
				x.rgb = x0.rgb;
				x.a   = x1.r;
			} else if(pad_in == 2.0){
				x.rg  = x0.rg;
				x.ba  = x1.rg;
			} else {
				x.r   = x0.r;
				x.gba = x1.rgb;
			}
		} else {
			x0 = texture2D( B, vec2((col + 2.0 - (N_in + pad_in)) / (N_in + pad_in) , row_t));
			if(pad_in == 0.0){
				x = x0;
			} else if(pad_in == 1.0){
				x.rgb = x0.gba;
				x.a   = x1.r;
			} else if(pad_in == 2.0){
				x.rg  = x0.ba;
				x.ba  = x1.rg;
			} else {
				x.r   = x0.a;
				x.gba = x1.rgb;
			}
		}

	}

	// fix padded region
	if(pad > 0.0 && col + 4.0 > N ) {
		fix_pad(x, int(pad));
	}

	gl_FragColor = x;
}
