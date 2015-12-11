#!/usr/bin/env python
"""Create data for the test suite described by the given specification

Usage:
	generate.py <spec.json>
"""
from docopt import docopt
import os
import json

import matrices
import multiply

if __name__ == '__main__':
	arguments = docopt(__doc__, version='JSON Matrix Generator')

	test_file = arguments['<spec.json>']

	with open(test_file, 'r') as f:
		tests = json.load(f)

	sorted_tests = sorted(list(tests.items()), key = lambda test : test[0])

	for [number, sizes] in sorted_tests:

		if os.path.exists(number):
			# skip existing directories
			print("Skipping {0}".format(number))
		else:
			os.makedirs(number)

			m = sizes[0]
			n = sizes[1]
			k = sizes[2]
			# run matrix creation
			#os.system("./matrices.py {0} {1} {2} {3}".format(m, n, k, number))
			[a, b] = matrices.create_matrices(m, n, k, number)

			# run mutliplication
			#os.system("./multiply.py {0}".format(number))
			multiply.create_matrix_multiply(number, a, b)

			print("Created {0}".format(number))
