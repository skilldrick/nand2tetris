#!/bin/sh
# Need to run build in the node project directory
pushd "$(dirname "$(realpath "$0")")";
npm run flow && npm run build
popd

# Need to run this in the jack code directory
hackparse2 $@
