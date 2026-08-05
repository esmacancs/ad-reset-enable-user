#!/usr/bin/env bash
# Start Next.js dev server (API is now inline)
cd /home/z/my-project
exec node node_modules/next/dist/bin/next dev -p 3000 -H 0.0.0.0 2>&1 | tee /home/z/my-project/dev.log
