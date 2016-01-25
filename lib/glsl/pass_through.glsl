// vertex shader for a single quad
// work is performed in the operation specific texture shader

precision highp float;

attribute vec3 pos;
attribute vec2 tex;
varying vec2   outTex;
void main(void)
{
	// just pass the position and texture coords
	gl_Position = vec4(pos, 1.0);
	outTex = tex;
}
