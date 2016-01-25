// sum of products between elements in row i (from A) x col j (from B)

// Calculate the dot product between the row (from A) and column (from B)
// identified by the passed indeces (output texture coordinate space).
// We loop over elements in the row and column and sum the product
// using the glsl `dot` function to process four elements at a time.
// This four element optimization requires that the matrix B be
// transposed before texel packing and that both matrices be padded
// (with zeros) to a multiple of four (4) in their shared dimension.
float dot_rowcol(float y, float x, sampler2D A, sampler2D B_t, int K) {
	float delta_t = 1./float(K);// space (on texture) between elements
	float sum = 0.;			// sum for this row/column pair
	float z = 0.5 * (4.0 * delta_t);// position for shared dimension on source textures

	for (int l=0 ; l<4096 ; ++l) {
		if(l >= K / 4) break;    // stop when we finish the row/column
		// l is in pixel space, so we divide by four

		// retrieve next four elements from each texture
		vec4 a_ik = texture2D(  A, vec2(z, y));
		vec4 b_kj = texture2D(B_t, vec2(z, x));

	// use `dot` to process four elements at a time
		sum +=  dot(a_ik, b_kj);
		z += (4.0 * delta_t);      // (z + 0.5)*delta
	}
	return sum;
}
#pragma glslify: export(dot_rowcol)
