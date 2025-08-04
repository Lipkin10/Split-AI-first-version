#!/bin/bash

set -euxo pipefail

# Database migrations now handled by Supabase
exec npm run start
