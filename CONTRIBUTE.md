# Shaders
Fragment shaders are where the computations happen. There are generally three
coordinate spaces that show up here. These conventions help keep track of them.

### Matrix Space
This is the space the matrix (or vector) lives in. It's the one you've seen in
Linear Algebra and any time you use an Array. Indexing variables contain `int`s
(usually starting at zero) and describe a row or column in the matrix.

```
row, col
i, j, k
```

### Pixel Space
This is the space that pixels live in on a texture (fragment shaders work on
textures, texture is just a fancy name for image). The difference between
matrix space and this space is that pixels usually contain more than one piece
of data (four in our data textures) from a row. Indexing variables contain `float`s
(usually integers with a 0.5 offset) and describe data from a group of columns
in a row.

```
row_p, col_p
l, m, n
```

### Texture Space
This is the coordinate space for accessing data from a texture. This is what
actually get's passed to WebGL texture functions (like `texture2D`) for
accessing data. Indexing variables contain `float`s in the range [0, 1]. The first
number passed to functions describes the x-axis or column (just like in math,
but opposite of most programming conventions).

```
col_t, row_t
x, y, z
```
