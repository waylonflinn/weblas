#!/usr/bin/env python
"""Parse input files as JSON matrices and multiply, writing result to JSON

Usage:
	multiply.py [<dir>]

Options:
	-h --help     Show this screen.
"""
from docopt import docopt
import json
import numpy as np

def create_matrix_multiply(prefix, alpha, A, B):

	prefix = prefix + '/'
	C = alpha * np.dot(A, B)

	filename = 'c.json'

	with open(prefix + filename, 'w') as f:
		json.dump(C.tolist(), f)

def open_and_multiply_matrices(prefix):

	prefix = prefix + "/"

	with open(prefix + 'a.json', 'r') as f:
		A = np.array(json.load(f))

	with open(prefix + 'b.json', 'r') as f:
		B = np.array(json.load(f))

	create_matrix_multiply(prefix, A, B)

if __name__ == '__main__':
	arguments = docopt(__doc__, version='JSON Matrix Generator')

	if '<dir>' in arguments and arguments['<dir>']:
		prefix = arguments['<dir>']

	else:
		prefix = "./"

	open_and_multiply_matrices(prefix)
