
# Notes
Useful stuff to know when trying to understand this library

* [BLAS Levels on Wikipedia](https://en.wikipedia.org/wiki/Basic_Linear_Algebra_Subprograms#Functionality)
* [Rendering Pipeline Overview](https://www.opengl.org/wiki/Rendering_Pipeline_Overview)
* [Convnetjs #13](https://github.com/karpathy/convnetjs/issues/13)

# Targets
Things I hope to make better

* [Synaptic.js](https://github.com/cazala/synaptic)
* [Convnetjs](https://github.com/karpathy/convnetjs)

# Performance Targets
[Matrix Multiply BLAS Benchmarks](http://gcdart.blogspot.com/2013/06/fast-matrix-multiply-and-ml.html)

# Based On
Where the ideas (and sometimes code) come from

* [glGemm in DeepBeliefSDK](https://github.com/jetpacapp/DeepBeliefSDK/blob/gh-pages/JavascriptLibrary/jpcnn.js)
* [WebGL Demo by Jonathan Watmough](https://github.com/watmough/webgl-matrix-demo)


## DeepBeliefSDK

* [Buffer](https://github.com/jetpacapp/DeepBeliefSDK/blob/42f95a766f297cbe16e1ea4dfd98d824d111220d/JavascriptLibrary/jpcnn.js#L73) - generalized array class. sometimes used at image level, sometimes batch level
  - stores TypedArray in `_data` (or `_quantizedData`)
  - shape stored in `Dimension` class in `_dims`
    - `[batch, rows, columns, channels]` (`this.valueAt(imageCount, y, x, channel)` from [showDebugImage](https://github.com/jetpacapp/DeepBeliefSDK/blob/42f95a766f297cbe16e1ea4dfd98d824d111220d/JavascriptLibrary/jpcnn.js#L196))
    - `[rows, columns, channels]` ( `this._dims.offset(originY, originX, 0);` from  [extractSubregion](https://github.com/jetpacapp/DeepBeliefSDK/blob/42f95a766f297cbe16e1ea4dfd98d824d111220d/JavascriptLibrary/jpcnn.js#L322))

* [Dimensions](https://github.com/jetpacapp/DeepBeliefSDK/blob/42f95a766f297cbe16e1ea4dfd98d824d111220d/JavascriptLibrary/jpcnn.js#L8) - shape class with some syntactic sugar
  - shape is a javascript Array stored in `_dims`


LICENSE:  [BSD 3-Clause](https://opensource.org/licenses/BSD-3-Clause)


## WebGL Demo

* [gpu_matrix](https://github.com/watmough/webgl-matrix-demo/blob/master/gpu_matrix.js#L33) simple matrix class
  - row-major ordering (c style)
  - stores typed array in `data`
  - dimensions (2D only) stored in `r` (row count) and `c` (column count) properties
