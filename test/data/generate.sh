#!/usr/bin/env bash

cd "${BASH_SOURCE%/*}" || exit

./generate.py sscal/ sscal/small.json
./generate.py sgemm/ sgemm/small.json
./generate.py sdwns/ sdwns/small.json
