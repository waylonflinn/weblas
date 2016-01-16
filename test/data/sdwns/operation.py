import numpy

def execute(options, matrices):
    X = matrices[0]
    factor = options['factor'] if 'factor' in options else 2.0
    stride = options['stride'] if 'stride' in options else 2.0

    return downsample(X, factor, stride)


def downsample(arr, factor, stride):
    """
    Downsample a 3D array by taking the maximum over *factor* pixels on the
    last two axes, skipping stride pixels between groups
    """

    xs, ys, zs = arr.shape
    cat_arr = numpy.array(numpy.concatenate([[arr[i:(xs - (factor - 1 - i)):stride, j:(ys - (factor - 1 - j)):stride, :] for i in range(factor)] for j in range(factor)]))

    result = cat_arr[0]
    for arr in cat_arr:
        #print(arr.shape)
        result = numpy.maximum(result, arr)

    return result
