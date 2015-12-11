#!/usr/bin/env python
"""Create two randomly generated matrices, of the specified sizes and write them
to JSON files.

Usage:
	matrices.py <m> <n> <k> [<dir>]

Options:
	-h --help     Show this screen.
"""
from docopt import docopt
import os
import json
import numpy as np


def create_matrix_json(path, shape):

	matrix = np.random.random_sample(shape)

	with open(path, 'w') as f:
		json.dump(matrix.tolist(), f)

	return matrix

def create_matrices(m, n, k, prefix):

	prefix = prefix + "/"

	matrix_spec = [
		(prefix + 'a.json' , (m, k)),
		(prefix + 'b.json' , (k, n))
	]

	matrices = []

	for (path, shape) in matrix_spec:
		matrices.append(create_matrix_json(path, shape))

	return matrices

if __name__ == '__main__':
	arguments = docopt(__doc__, version='JSON Matrix Generator')

	m = int(arguments['<m>']) # rows in a
	k = int(arguments['<k>']) # columns in a and rows in b
	n = int(arguments['<n>']) # columns in b

	if '<dir>' in arguments and arguments['<dir>']:
		prefix = arguments['<dir>']
	else:
		prefix = "./"

	create_matrices(m, n, k, prefix)
