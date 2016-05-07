// PACKED TO PACKED (UNPADDED)
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A

void main(void) {
	
	gl_FragColor = texture2D( A, outTex );
}