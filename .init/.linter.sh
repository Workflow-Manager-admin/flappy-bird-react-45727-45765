#!/bin/bash
cd /home/kavia/workspace/code-generation/flappy-bird-react-45727-45765/flappybird_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

