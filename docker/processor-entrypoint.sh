#!/bin/sh
set -e
echo "Starting processor..."
exec node dist/apps/processor/main.js
