#!/usr/bin/env python
"""Create data for the test suite described by the given specification.
Deleting the file out.json in a subdirectory will cause it to be recreated
with existing data and new "args". Deleting all files in a subdirectory will
case all data to be recreated.

	spec.json contains an array of objects, each object contains
	"in" and "args" parameters
	"in" is an array of arrays which define the size and contents of a matrix
		[[M, N, a, b]] produces a single MxN matrix of numbers in [0, 1) and
		scales it according to: a * X + b. uses `numpy.random.random_sample`

	"args" is a dictionary of arguments to pass to the operation specified for
	the test, along with an array of the input matrices.

Implementing test data generation for a new operation involves two things:
1. creation of a json spec
2. implementing an operation file with a single function named execute

Usage:
	generate.py <directory> <spec.json>
"""
from docopt import docopt
import os
import sys
import json
import numpy as np
import json_matrix


# names to use for json files storing input matrices
default_names = ['a.json', 'b.json', 'c.json']

def create_matrix(spec):

	m = spec[0]
	n = spec[1]

	a = spec[2] if len(spec) > 2 else 1.0
	b = spec[3] if len(spec) > 3 else 0.0

	return (a * np.random.random_sample((m, n))) + b

if __name__ == '__main__':
	arguments = docopt(__doc__, version='JSON Matrix Generator')

	base_directory = os.path.join(arguments['<directory>'], '')
	test_file = arguments['<spec.json>']

	sys.path.insert(0, './' + base_directory)

	operation = __import__("operation")

	with open(test_file, 'r') as f:
		tests = json.load(f)


	for i in range(len(tests)):

		options = tests[i]
		directory = base_directory + "{0:0>4}/".format(i + 1)

		if not os.path.exists(directory):
			os.makedirs(directory)

		# if a result exists, skip this data set
		if os.path.exists(directory + 'out.json'):
			print("Skipping {0}".format(directory))
			continue

		names = map(lambda i: default_names[i], range(len(options['in'])))

		all_exist = False
		for name in names:
			all_exist = all_exist & os.path.exists(directory + name)

		if all_exist:
			matrices = map(lambda name : json_matrix.read(directory + name), names)
		else:
			matrices = []
			for i in range(len(names)):
				name = names[i]
				spec = options['in'][i]
				matrix = create_matrix(spec)
				matrices.append(matrix)

				json_matrix.write(directory + name, matrix)

		arguments = options['arg'] if 'arg' in options else {}
		out = operation.execute(arguments, matrices)

		# run mutliplication
		#os.system("./multiply.py {0}".format(number))
		json_matrix.write(directory + "out.json", out)

		print("Created {0}".format(directory))