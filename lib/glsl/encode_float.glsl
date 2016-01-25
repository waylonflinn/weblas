// Render float to bytes according to IEEE 754 Floating Point
vec4 encode_float(float val) {

	// TODO: correctly handle denormal numbers
	// http://www.2ality.com/2012/04/number-encoding.html
	float a = abs(val);                           // encode absolute value + sign
	float exp = floor(log2(a));                 // number of powers of 2
	float mant = pow(2.,log2(a)-exp) * pow(2.,23.);  // multiply to fill 24 bits (implied leading 1)
	float mant1 = floor(mant / 256. / 256.);    // first 8 bits of mantissa
	float mant2 = mod(floor(mant / 256.),256.); // second 8 bits
	float mant3 = mod(mant,256.);               // third 8 bits

	highp float sign = 128.-128.*(a/val);			// sign bit is 256 or 0
	highp float e = (sign+exp+127.)/510.;		// exponent and sign
	highp float m1 = (mant1-(128.*(1.-mod(exp+127.,2.))))/255.; // handle leading bit
	highp float m2 = (mant2)/255.;				// middle part
	highp float m3 = (mant3+.5)/255.;			// scale to 0 - 255

	return vec4(m3,m2,m1,e);
}
#pragma glslify: export(encode_float)
