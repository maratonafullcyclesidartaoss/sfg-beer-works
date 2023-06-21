#!/bin/bash
kubectl testkube create test --file ../create_brewery_load.js --type k6/script --name create-brewery-load
kubectl testkube run test create-brewery-load -f